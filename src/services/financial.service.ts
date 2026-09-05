import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, FinancialTransactionStatus, FinancialTransactionType } from "@/types/supabase"
import { fetchPage } from "@/lib/paginated-query"

type DB = SupabaseClient<Database>

export type TransactionInput = {
  patient_id?: string | null
  appointment_id?: string | null
  type: FinancialTransactionType
  category?: string | null
  description?: string | null
  amount: number
  due_date?: string | null
}

export async function listPaymentMethods(supabase: DB, clinicId: string) {
  const { data, error } = await supabase
    .from("payment_methods")
    .select("id, name, slug")
    .eq("clinic_id", clinicId)
    .eq("active", true)
    .order("name")
  if (error) throw error
  return data ?? []
}

export type TransactionView = Database["public"]["Tables"]["financial_transactions"]["Row"] & {
  patientName: string | null
  /** Venda de pacote ou sessão consumida de um — a tabela marca a linha para o valor
   * (zero, nas sessões) não parecer um lançamento errado. */
  isPackage: boolean
}

/**
 * Página de lançamentos, com o total.
 *
 * O teto de 200 registros de antes escondia o histórico: a clínica com um ano de movimento
 * via a lista parar num ponto arbitrário, e um relatório informal de "quanto entrou" saía
 * errado sem nada indicar que faltava linha.
 */
/** ids de transações que são "pacote" — a compra (patient_packages.financial_transaction_id)
 * ou uma sessão individual já paga (marcada com o prefixo de descrição fixo usado em
 * createPackageSessionCharge). Usado tanto pelo filtro avulsa/pacote quanto pelo resumo. */
async function packageTransactionIds(supabase: DB, clinicId: string): Promise<string[]> {
  const [{ data: purchases }, { data: sessions }] = await Promise.all([
    supabase
      .from("patient_packages")
      .select("financial_transaction_id")
      .eq("clinic_id", clinicId)
      .not("financial_transaction_id", "is", null),
    supabase
      .from("financial_transactions")
      .select("id")
      .eq("clinic_id", clinicId)
      .ilike("description", "Sessão de pacote —%"),
  ])
  const ids = new Set<string>()
  for (const p of purchases ?? []) if (p.financial_transaction_id) ids.add(p.financial_transaction_id)
  for (const s of sessions ?? []) ids.add(s.id)
  return [...ids]
}

export async function listTransactions(
  supabase: DB,
  clinicId: string,
  opts: {
    type?: FinancialTransactionType
    status?: FinancialTransactionStatus
    /** Vários status de uma vez — "contas pendentes" é pendente OU atrasado. */
    statuses?: FinancialTransactionStatus[]
    patientId?: string
    professionalId?: string
    paymentMethodId?: string
    sourceType?: "avulsa" | "pacote"
    dateFrom?: string
    dateTo?: string
    offset?: number
    rangeEnd?: number
  } = {}
): Promise<{ rows: TransactionView[]; total: number }> {
  // Filtros que exigem descobrir uma lista de ids antes da consulta principal — o
  // PostgREST não faz join condicional nestas duas direções (appointments/payments não
  // têm FK de volta para financial_transactions que dê pra encadear num único `.select`).
  let appointmentIds: string[] | null = null
  if (opts.professionalId) {
    const { data } = await supabase
      .from("appointments")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("professional_id", opts.professionalId)
    appointmentIds = (data ?? []).map((a) => a.id)
  }

  let paymentTransactionIds: string[] | null = null
  if (opts.paymentMethodId) {
    const { data } = await supabase
      .from("payments")
      .select("financial_transaction_id")
      .eq("clinic_id", clinicId)
      .eq("payment_method_id", opts.paymentMethodId)
    paymentTransactionIds = [...new Set((data ?? []).map((p) => p.financial_transaction_id))]
  }

  // "pacote" filtra por inclusão nesta lista; "avulsa" filtra por exclusão dela. Sempre
  // carregada (não só quando há filtro) porque cada linha também precisa saber se é de
  // pacote para exibir o selo.
  const packageIds = await packageTransactionIds(supabase, clinicId)
  const packageIdSet = new Set(packageIds)

  const { rows: data, total } = await fetchPage(() => {
    let query = supabase
      .from("financial_transactions")
      .select("*", { count: "exact" })
      .eq("clinic_id", clinicId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })

    if (opts.type) query = query.eq("type", opts.type)
    if (opts.status) query = query.eq("status", opts.status)
    if (opts.statuses?.length) query = query.in("status", opts.statuses)
    if (opts.patientId) query = query.eq("patient_id", opts.patientId)
    if (opts.dateFrom) query = query.gte("created_at", opts.dateFrom)
    if (opts.dateTo) query = query.lte("created_at", opts.dateTo)
    if (appointmentIds) query = query.in("appointment_id", appointmentIds)
    if (paymentTransactionIds) query = query.in("id", paymentTransactionIds)
    if (opts.sourceType === "pacote") {
      query = query.in("id", packageIds.length > 0 ? packageIds : ["00000000-0000-0000-0000-000000000000"])
    }
    if (opts.sourceType === "avulsa" && packageIds.length > 0) {
      query = query.not("id", "in", `(${packageIds.join(",")})`)
    }
    return query
  }, opts)

  const patientIds = [...new Set((data ?? []).map((t) => t.patient_id).filter(Boolean))] as string[]
  const patientById = new Map<string, string>()
  if (patientIds.length > 0) {
    const { data: patients } = await supabase
      .from("patients")
      .select("id, full_name, social_name")
      .in("id", patientIds)
    for (const p of patients ?? []) patientById.set(p.id, p.social_name || p.full_name)
  }

  return {
    rows: (data ?? []).map((t) => ({
      ...t,
      patientName: t.patient_id ? patientById.get(t.patient_id) ?? null : null,
      isPackage: packageIdSet.has(t.id),
    })),
    total,
  }
}

export async function getTransactionByAppointment(supabase: DB, clinicId: string, appointmentId: string) {
  const { data, error } = await supabase
    .from("financial_transactions")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("appointment_id", appointmentId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getTransaction(supabase: DB, clinicId: string, transactionId: string) {
  const { data, error } = await supabase
    .from("financial_transactions")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("id", transactionId)
    .single()
  if (error) throw error
  return data
}

export async function createTransaction(supabase: DB, clinicId: string, createdBy: string, input: TransactionInput) {
  const { data, error } = await supabase
    .from("financial_transactions")
    .insert({ ...input, clinic_id: clinicId, created_by: createdBy })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

export async function cancelTransaction(supabase: DB, clinicId: string, transactionId: string) {
  const { error } = await supabase
    .from("financial_transactions")
    .update({ status: "cancelado" })
    .eq("clinic_id", clinicId)
    .eq("id", transactionId)
  if (error) throw error
}

/**
 * Corrige o valor de um lançamento já registrado.
 *
 * Só o valor: descrição, paciente e vínculos ficam como estão, porque o caso de uso é
 * "digitaram 100 em vez de 1000" ou "esta sessão de pacote precisa carregar o valor do
 * pacote". Quem chama grava o valor anterior no audit_log — sem isso, uma correção fica
 * indistinguível de um lançamento que sempre foi daquele jeito.
 */
export async function updateTransactionAmount(
  supabase: DB,
  clinicId: string,
  transactionId: string,
  amount: number
) {
  const { error } = await supabase
    .from("financial_transactions")
    .update({ amount })
    .eq("clinic_id", clinicId)
    .eq("id", transactionId)
  if (error) throw error
}

export async function listPaymentsForTransaction(supabase: DB, transactionId: string) {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("financial_transaction_id", transactionId)
    .order("paid_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function registerPayment(
  supabase: DB,
  clinicId: string,
  input: { transactionId: string; paymentMethodId: string; amount: number; receivedBy: string; notes?: string | null }
) {
  const { error } = await supabase.from("payments").insert({
    clinic_id: clinicId,
    financial_transaction_id: input.transactionId,
    payment_method_id: input.paymentMethodId,
    amount: input.amount,
    received_by: input.receivedBy,
    notes: input.notes ?? null,
  })
  if (error) throw error

  const [{ data: payments }, transaction] = await Promise.all([
    supabase.from("payments").select("amount").eq("financial_transaction_id", input.transactionId),
    getTransaction(supabase, clinicId, input.transactionId),
  ])
  const totalPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0)

  if (totalPaid >= Number(transaction.amount)) {
    const { error: statusError } = await supabase
      .from("financial_transactions")
      .update({ status: "pago" })
      .eq("clinic_id", clinicId)
      .eq("id", input.transactionId)
    if (statusError) throw statusError
  }
}

/**
 * Só a contagem, sem trazer linha alguma.
 *
 * Alimenta o número na aba "Contas pendentes", que precisa refletir o total e não a página
 * aberta — quem vê "Contas pendentes (25)" com 25 por página não aprendeu nada. `head: true`
 * faz o PostgREST devolver a contagem no cabeçalho e nenhum corpo.
 */
export async function countTransactions(
  supabase: DB,
  clinicId: string,
  opts: {
    type?: FinancialTransactionType
    statuses?: FinancialTransactionStatus[]
  } = {}
): Promise<number> {
  let query = supabase
    .from("financial_transactions")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)

  if (opts.type) query = query.eq("type", opts.type)
  if (opts.statuses?.length) query = query.in("status", opts.statuses)

  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

export type FinancialSummary = {
  avulsaTotal: number
  pacoteTotal: number
  averageTicket: number
  byProfessional: { professionalId: string; professionalName: string; total: number }[]
  bySpecialty: { specialtyId: string; specialtyName: string; total: number }[]
}

/**
 * Visões agregadas do requisito 7 — "destrinchar ao máximo" a receita.
 *
 * Decisão de atribuição (sem coluna nova em financial_transactions): receita AVULSA
 * quebra por profissional via o agendamento vinculado (appointment_id →
 * appointments.professional_id) — é o dado que já existe. Receita de PACOTE não tem um
 * profissional específico por natureza (o pacote é por especialidade, usável por
 * qualquer profissional dela) — é reportada só por especialidade
 * (session_packages.specialty_id via patient_packages). Rateá-la por profissional
 * exigiria inventar uma regra de divisão que a clínica não pediu.
 */
export async function getFinancialSummary(
  supabase: DB,
  clinicId: string,
  opts: { dateFrom?: string; dateTo?: string; professionalId?: string } = {}
): Promise<FinancialSummary> {
  const packageIds = await packageTransactionIds(supabase, clinicId)

  // Recorte por profissional: chega pelo agendamento vinculado, o mesmo caminho da quebra
  // "receita avulsa por profissional" abaixo. É o que sustenta a tela "Meu financeiro".
  let professionalAppointmentIds: string[] | null = null
  if (opts.professionalId) {
    const { data } = await supabase
      .from("appointments")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("professional_id", opts.professionalId)
    professionalAppointmentIds = (data ?? []).map((a) => a.id)
  }

  let query = supabase
    .from("financial_transactions")
    .select("id, amount, appointment_id")
    .eq("clinic_id", clinicId)
    .eq("type", "receita")
    .eq("status", "pago")
  if (opts.dateFrom) query = query.gte("created_at", opts.dateFrom)
  if (opts.dateTo) query = query.lte("created_at", opts.dateTo)
  if (professionalAppointmentIds) {
    query = query.in(
      "appointment_id",
      professionalAppointmentIds.length > 0
        ? professionalAppointmentIds
        : ["00000000-0000-0000-0000-000000000000"]
    )
  }
  const { data: paidReceitas, error } = await query
  if (error) throw error

  const rows = paidReceitas ?? []
  const packageIdSet = new Set(packageIds)
  const avulsaRows = rows.filter((r) => !packageIdSet.has(r.id))
  const pacoteRows = rows.filter((r) => packageIdSet.has(r.id))

  const avulsaTotal = avulsaRows.reduce((sum, r) => sum + Number(r.amount), 0)
  const pacoteTotal = pacoteRows.reduce((sum, r) => sum + Number(r.amount), 0)

  // Ticket médio conta só o que teve valor. As sessões de pacote entram como R$ 0 (já
  // pagas na venda) e, se contassem como lançamento, puxariam a média para baixo sem que
  // nada tivesse mudado no caixa — foi exatamente o que apareceu na primeira validação.
  const billedRows = rows.filter((r) => Number(r.amount) > 0)
  const averageTicket =
    billedRows.length > 0 ? (avulsaTotal + pacoteTotal) / billedRows.length : 0

  // Avulsa por profissional.
  const avulsaAppointmentIds = [...new Set(avulsaRows.map((r) => r.appointment_id).filter(Boolean))] as string[]
  const { data: appointments } =
    avulsaAppointmentIds.length > 0
      ? await supabase.from("appointments").select("id, professional_id").in("id", avulsaAppointmentIds)
      : { data: [] as { id: string; professional_id: string }[] }
  const professionalByAppointment = new Map((appointments ?? []).map((a) => [a.id, a.professional_id]))
  const professionalIds = [...new Set((appointments ?? []).map((a) => a.professional_id))]
  const { data: professionals } =
    professionalIds.length > 0
      ? await supabase.from("professionals").select("id, full_name").in("id", professionalIds)
      : { data: [] as { id: string; full_name: string }[] }
  const professionalNameById = new Map((professionals ?? []).map((p) => [p.id, p.full_name]))

  const byProfessionalTotals = new Map<string, number>()
  for (const r of avulsaRows) {
    const professionalId = r.appointment_id ? professionalByAppointment.get(r.appointment_id) : null
    if (!professionalId) continue
    byProfessionalTotals.set(professionalId, (byProfessionalTotals.get(professionalId) ?? 0) + Number(r.amount))
  }
  const byProfessional = [...byProfessionalTotals.entries()]
    .map(([professionalId, total]) => ({
      professionalId,
      professionalName: professionalNameById.get(professionalId) ?? "—",
      total,
    }))
    .sort((a, b) => b.total - a.total)

  // Pacote por especialidade.
  const { data: patientPackages } =
    pacoteRows.length > 0
      ? await supabase
          .from("patient_packages")
          .select("financial_transaction_id, session_packages(specialty_id, specialties(id, name))")
          .in(
            "financial_transaction_id",
            pacoteRows.map((r) => r.id)
          )
      : { data: [] as { financial_transaction_id: string | null; session_packages: { specialty_id: string; specialties: { id: string; name: string } | null } | null }[] }

  const amountByTransaction = new Map(pacoteRows.map((r) => [r.id, Number(r.amount)]))
  const bySpecialtyTotals = new Map<string, { name: string; total: number }>()
  for (const pp of patientPackages ?? []) {
    if (!pp.financial_transaction_id) continue
    const amount = amountByTransaction.get(pp.financial_transaction_id) ?? 0
    const specialty = pp.session_packages?.specialties
    if (!specialty) continue
    const existing = bySpecialtyTotals.get(specialty.id)
    bySpecialtyTotals.set(specialty.id, { name: specialty.name, total: (existing?.total ?? 0) + amount })
  }
  const bySpecialty = [...bySpecialtyTotals.entries()]
    .map(([specialtyId, { name, total }]) => ({ specialtyId, specialtyName: name, total }))
    .sort((a, b) => b.total - a.total)

  return { avulsaTotal, pacoteTotal, averageTicket, byProfessional, bySpecialty }
}
