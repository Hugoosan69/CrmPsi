import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/supabase"

type DB = SupabaseClient<Database>

export type SessionPackageInput = {
  specialty_id: string
  name: string
  total_sessions: number
  total_price: number
  /** 'unico' = valor total na venda, sessões a R$ 0. 'por_sessao' = valor diluído por
   * sessão consumida. Ver database/migrations/019. */
  billing_mode: "unico" | "por_sessao"
}

export type SessionPackageView = Database["public"]["Tables"]["session_packages"]["Row"] & {
  specialtyName: string
}

export async function listSessionPackages(
  supabase: DB,
  clinicId: string,
  opts: { activeOnly?: boolean } = {}
): Promise<SessionPackageView[]> {
  let query = supabase
    .from("session_packages")
    .select("*, specialties(name)")
    .eq("clinic_id", clinicId)
    .order("name")

  if (opts.activeOnly) query = query.eq("active", true)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(({ specialties, ...row }) => ({
    ...row,
    specialtyName: (specialties as { name: string } | null)?.name ?? "—",
  }))
}

export async function createSessionPackage(supabase: DB, clinicId: string, input: SessionPackageInput) {
  const { data, error } = await supabase
    .from("session_packages")
    .insert({ ...input, clinic_id: clinicId })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

export async function updateSessionPackage(
  supabase: DB,
  clinicId: string,
  id: string,
  input: SessionPackageInput
) {
  const { error } = await supabase
    .from("session_packages")
    .update(input)
    .eq("clinic_id", clinicId)
    .eq("id", id)
  if (error) throw error
}

export type PackageSyncResult = {
  /** Saldos de paciente que passaram a refletir o catálogo. */
  updated: number
  /** Saldos que já estavam iguais — nada a fazer. */
  unchanged: number
  /** Saldos com mais sessões usadas do que o catálogo passou a ter. Não são mexidos:
   *  encolher um pacote abaixo do que o paciente já usou apagaria atendimento realizado. */
  skipped: number
}

/**
 * Reprocessa os saldos já vendidos de um pacote do catálogo.
 *
 * `patient_packages` guarda `total_sessions`/`total_price` como **snapshot da venda**, de
 * propósito: mudar o preço do catálogo não pode reescrever o valor do que já foi vendido e
 * cobrado. Só que isso tem o outro lado — o pacote cadastrado com 1 sessão por engano e
 * corrigido depois para 4 deixa o paciente preso ao "1/1" antigo, na agenda e na ficha.
 *
 * Esta função alinha os saldos ao catálogo atual e recalcula o status (um pacote fechado
 * que ganhou sessões volta a ficar ativo). Pacotes cancelados ficam de fora, e os que já
 * consumiram mais sessões do que o novo total são pulados e contados à parte, para a tela
 * dizer quantos precisam de decisão humana em vez de sumir com o histórico.
 */
export async function syncPatientPackagesWithCatalog(
  supabase: DB,
  clinicId: string,
  sessionPackageId: string
): Promise<PackageSyncResult> {
  const { data: pkg, error: pkgError } = await supabase
    .from("session_packages")
    .select("total_sessions, total_price")
    .eq("clinic_id", clinicId)
    .eq("id", sessionPackageId)
    .single()
  if (pkgError) throw pkgError

  const { data: balances, error } = await supabase
    .from("patient_packages")
    .select("id, total_sessions, total_price, sessions_used, status")
    .eq("clinic_id", clinicId)
    .eq("session_package_id", sessionPackageId)
    .neq("status", "cancelled")
  if (error) throw error

  const result: PackageSyncResult = { updated: 0, unchanged: 0, skipped: 0 }

  for (const balance of balances ?? []) {
    if (balance.sessions_used > pkg.total_sessions) {
      result.skipped += 1
      continue
    }

    const status = balance.sessions_used >= pkg.total_sessions ? "completed" : "active"
    const sameSessions = balance.total_sessions === pkg.total_sessions
    const samePrice = Number(balance.total_price) === Number(pkg.total_price)
    if (sameSessions && samePrice && balance.status === status) {
      result.unchanged += 1
      continue
    }

    const { error: updateError } = await supabase
      .from("patient_packages")
      .update({
        total_sessions: pkg.total_sessions,
        total_price: pkg.total_price,
        status,
      })
      .eq("clinic_id", clinicId)
      .eq("id", balance.id)
    if (updateError) throw updateError
    result.updated += 1
  }

  return result
}

export async function setSessionPackageActive(supabase: DB, clinicId: string, id: string, active: boolean) {
  const { error } = await supabase
    .from("session_packages")
    .update({ active })
    .eq("clinic_id", clinicId)
    .eq("id", id)
  if (error) throw error
}

export type PatientPackageView = Database["public"]["Tables"]["patient_packages"]["Row"] & {
  packageName: string
  specialtyName: string
}

/** Pacotes com saldo (ativos), para a aba "Pacotes" da ficha do paciente e para o
 * seletor de "usar sessão do pacote" no agendamento. */
export async function listActivePatientPackages(
  supabase: DB,
  clinicId: string,
  patientId: string
): Promise<PatientPackageView[]> {
  const { data, error } = await supabase
    .from("patient_packages")
    .select("*, session_packages(name, specialties(name))")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .eq("status", "active")
    .order("purchased_at", { ascending: false })
  if (error) throw error

  return (data ?? []).map(({ session_packages, ...row }) => {
    const sp = session_packages as { name: string; specialties: { name: string } | null } | null
    return {
      ...row,
      packageName: sp?.name ?? "—",
      specialtyName: sp?.specialties?.name ?? "—",
    }
  })
}

export async function listAllPatientPackages(
  supabase: DB,
  clinicId: string,
  patientId: string
): Promise<PatientPackageView[]> {
  const { data, error } = await supabase
    .from("patient_packages")
    .select("*, session_packages(name, specialties(name))")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .order("purchased_at", { ascending: false })
  if (error) throw error

  return (data ?? []).map(({ session_packages, ...row }) => {
    const sp = session_packages as { name: string; specialties: { name: string } | null } | null
    return {
      ...row,
      packageName: sp?.name ?? "—",
      specialtyName: sp?.specialties?.name ?? "—",
    }
  })
}

/**
 * Venda de pacote: cobrança única e integral, à vista. Cria a transação já paga (o
 * pagamento é registrado no mesmo golpe, não fica pendente por um instante sequer) e o
 * saldo do paciente com `sessions_used = 0`.
 */
export async function sellPackage(
  supabase: DB,
  clinicId: string,
  input: {
    patientId: string
    sessionPackageId: string
    paymentMethodId: string
    createdBy: string
    notes?: string | null
  }
) {
  const { data: pkg, error: pkgError } = await supabase
    .from("session_packages")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("id", input.sessionPackageId)
    .single()
  if (pkgError) throw pkgError

  // Em `por_sessao` o valor é reconhecido conforme as sessões acontecem — lançar o total
  // aqui *e* nas sessões contaria a mesma receita duas vezes. O saldo é criado, e cada
  // sessão traz a sua parte.
  if (pkg.billing_mode === "por_sessao") {
    return createPatientPackageWithoutCharge(supabase, clinicId, {
      patientId: input.patientId,
      sessionPackageId: pkg.id,
    })
  }

  const { data: transaction, error: txError } = await supabase
    .from("financial_transactions")
    .insert({
      clinic_id: clinicId,
      created_by: input.createdBy,
      patient_id: input.patientId,
      type: "receita",
      category: pkg.name,
      description: `Venda de pacote — ${pkg.name}`,
      amount: pkg.total_price,
    })
    .select("id")
    .single()
  if (txError) throw txError

  const { error: paymentError } = await supabase.from("payments").insert({
    clinic_id: clinicId,
    financial_transaction_id: transaction.id,
    payment_method_id: input.paymentMethodId,
    amount: pkg.total_price,
    received_by: input.createdBy,
    notes: input.notes ?? null,
  })
  if (paymentError) throw paymentError

  const { error: statusError } = await supabase
    .from("financial_transactions")
    .update({ status: "pago" })
    .eq("clinic_id", clinicId)
    .eq("id", transaction.id)
  if (statusError) throw statusError

  const { data: patientPackage, error: ppError } = await supabase
    .from("patient_packages")
    .insert({
      clinic_id: clinicId,
      patient_id: input.patientId,
      session_package_id: pkg.id,
      total_sessions: pkg.total_sessions,
      total_price: pkg.total_price,
      financial_transaction_id: transaction.id,
    })
    .select("id")
    .single()
  if (ppError) throw ppError

  return patientPackage.id
}

/**
 * Reserva uma posição no pacote para um agendamento recém-criado — não consome saldo
 * ainda (isso só acontece quando a sessão é de fato realizada, ver `consumePackageSession`).
 * `session_number` é o próximo número disponível, contando toda reserva já feita (mesmo
 * as liberadas depois), para nunca reaproveitar um número dentro do mesmo pacote.
 */
export async function reservePackageSession(
  supabase: DB,
  clinicId: string,
  input: { patientPackageId: string; appointmentId: string; sessionNumber?: number }
) {
  // Sem número informado (fluxo do agendamento novo), pega a primeira posição livre — e
  // "livre" considera as liberadas, que voltam a valer. Com número informado (vínculo
  // manual), respeita a escolha; o índice único de migrations/018 recusa uma posição já
  // ocupada mesmo que a tela tenha sido montada com uma lista velha.
  const takenNumbers = await takenSessionNumbers(supabase, input.patientPackageId)
  let sessionNumber = input.sessionNumber
  if (!sessionNumber) {
    sessionNumber = 1
    while (takenNumbers.includes(sessionNumber)) sessionNumber += 1
  }

  const { data, error } = await supabase
    .from("patient_package_sessions")
    .insert({
      patient_package_id: input.patientPackageId,
      appointment_id: input.appointmentId,
      session_number: sessionNumber,
    })
    .select("id, session_number")
    .single()
  if (error) throw error

  const { error: apptError } = await supabase
    .from("appointments")
    .update({ patient_package_session_id: data.id })
    .eq("clinic_id", clinicId)
    .eq("id", input.appointmentId)
  if (apptError) throw apptError

  return data
}

/** Posições já ocupadas num pacote — liberadas não contam, voltam a ficar disponíveis. */
export async function takenSessionNumbers(
  supabase: DB,
  patientPackageId: string
): Promise<number[]> {
  const { data, error } = await supabase
    .from("patient_package_sessions")
    .select("session_number")
    .eq("patient_package_id", patientPackageId)
    .neq("status", "released")
  if (error) throw error
  return (data ?? []).map((s) => s.session_number)
}

/**
 * Cria o saldo de um pacote para o paciente **sem lançar cobrança**.
 *
 * É o caso da correção retroativa: a clínica vendeu o pacote fora do sistema (ou o
 * dinheiro já entrou por outro lançamento) e o que falta é só registrar o saldo para as
 * sessões passarem a debitar dele. Lançar uma receita aqui cobraria de novo, no papel, o
 * que já foi pago.
 *
 * A venda de verdade — com cobrança e recebimento — é `sellPackage`.
 */
export async function createPatientPackageWithoutCharge(
  supabase: DB,
  clinicId: string,
  input: { patientId: string; sessionPackageId: string }
) {
  const { data: pkg, error: pkgError } = await supabase
    .from("session_packages")
    .select("id, total_sessions, total_price")
    .eq("clinic_id", clinicId)
    .eq("id", input.sessionPackageId)
    .single()
  if (pkgError) throw pkgError

  const { data, error } = await supabase
    .from("patient_packages")
    .insert({
      clinic_id: clinicId,
      patient_id: input.patientId,
      session_package_id: pkg.id,
      total_sessions: pkg.total_sessions,
      total_price: pkg.total_price,
      // financial_transaction_id fica nulo de propósito: não há cobrança nova.
    })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

/**
 * Vincula um agendamento já existente a um pacote (item pedido depois da primeira
 * validação: o paciente é de pacote, mas a consulta já estava na agenda).
 *
 * Um agendamento já concluído entra direto como `consumed` — a sessão aconteceu, não há o
 * que reservar. Os demais entram como `reserved` e seguem o ciclo normal (consome ao
 * finalizar o atendimento, libera se cancelar ou faltar com justificativa).
 */
export async function linkAppointmentToPackage(
  supabase: DB,
  clinicId: string,
  input: {
    appointmentId: string
    patientPackageId: string
    alreadyHappened: boolean
    sessionNumber?: number
  }
) {
  const existing = await getPackageSessionForAppointment(supabase, input.appointmentId)
  if (existing) {
    throw new Error("Este agendamento já está vinculado a um pacote.")
  }

  const { data, error } = await supabase
    .from("patient_packages")
    .select("sessions_used, total_sessions, status")
    .eq("clinic_id", clinicId)
    .eq("id", input.patientPackageId)
    .single()
  if (error) throw error
  if (data.sessions_used >= data.total_sessions) {
    throw new Error("Este pacote não tem mais sessões disponíveis.")
  }

  if (input.sessionNumber && input.sessionNumber > data.total_sessions) {
    throw new Error(`Este pacote tem ${data.total_sessions} sessões.`)
  }

  const reserved = await reservePackageSession(supabase, clinicId, {
    patientPackageId: input.patientPackageId,
    appointmentId: input.appointmentId,
    sessionNumber: input.sessionNumber,
  })

  if (input.alreadyHappened) {
    await consumePackageSession(supabase, reserved.id)
  }

  return reserved
}

export async function getPackageSessionForAppointment(supabase: DB, appointmentId: string) {
  const { data, error } = await supabase
    .from("patient_package_sessions")
    .select("*, patient_packages(total_sessions)")
    .eq("appointment_id", appointmentId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const { patient_packages, ...row } = data
  return { ...row, totalSessions: (patient_packages as { total_sessions: number } | null)?.total_sessions ?? null }
}

/** Sessão realizada: consome o saldo (o gatilho no banco incrementa `sessions_used` e
 * fecha o pacote se for a última). Chamado só a partir de `finishService`. */
export async function consumePackageSession(supabase: DB, patientPackageSessionId: string) {
  const { error } = await supabase
    .from("patient_package_sessions")
    .update({ status: "consumed", consumed_at: new Date().toISOString() })
    .eq("id", patientPackageSessionId)
    .eq("status", "reserved")
  if (error) throw error
}

/** Cancelamento ou falta justificada: libera a posição sem consumir saldo. */
export async function releasePackageSession(supabase: DB, patientPackageSessionId: string) {
  const { error } = await supabase
    .from("patient_package_sessions")
    .update({ status: "released" })
    .eq("id", patientPackageSessionId)
    .eq("status", "reserved")
  if (error) throw error
}

/**
 * Quanto uma sessão de pacote lança no financeiro, conforme o `billing_mode` do pacote
 * (migrations/019): `unico` → R$ 0,00 (o dinheiro entrou uma vez, na venda; repetir aqui
 * dobraria a receita), `por_sessao` → total ÷ nº de sessões.
 */
async function packageSessionAmount(
  supabase: DB,
  patientPackageSessionId?: string | null
): Promise<number> {
  if (!patientPackageSessionId) return 0

  const { data } = await supabase
    .from("patient_package_sessions")
    .select("patient_packages(total_price, total_sessions, session_packages(billing_mode))")
    .eq("id", patientPackageSessionId)
    .maybeSingle()

  const pp = data?.patient_packages as
    | { total_price: number; total_sessions: number; session_packages: { billing_mode: string } | null }
    | null
  if (pp?.session_packages?.billing_mode === "por_sessao" && pp.total_sessions > 0) {
    return Math.round((Number(pp.total_price) / pp.total_sessions) * 100) / 100
  }
  return 0
}

/**
 * Sessão de pacote no check-in: já paga na venda, então nasce com `status: pago` — o que
 * satisfaz o gate de pagamento da fila (migration 001) sem nenhuma ação de cobrança na
 * recepção.
 *
 * O valor depende do `billing_mode` do pacote (migrations/019): em `unico` a sessão entra
 * a R$ 0,00, porque o dinheiro já foi contabilizado uma vez na venda e repetir aqui
 * dobraria a receita; em `por_sessao`, entra o valor por sessão, para quem prefere ver a
 * receita distribuída ao longo do tratamento.
 */
export async function createPackageSessionCharge(
  supabase: DB,
  clinicId: string,
  input: {
    patientId: string
    appointmentId: string
    createdBy: string
    category: string
    /** Sessão do pacote deste agendamento, quando houver — define o valor a lançar. */
    patientPackageSessionId?: string | null
  }
) {
  const amount = await packageSessionAmount(supabase, input.patientPackageSessionId)

  const { data, error } = await supabase
    .from("financial_transactions")
    .insert({
      clinic_id: clinicId,
      created_by: input.createdBy,
      patient_id: input.patientId,
      appointment_id: input.appointmentId,
      type: "receita",
      category: input.category,
      description: `Sessão de pacote — ${input.category}`,
      amount,
      status: "pago",
    })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

/**
 * Quita as cobranças em aberto de um agendamento que acabou de ser reconhecido como sessão
 * de pacote.
 *
 * O caso é o do dia a dia: a recepção lançou a consulta como avulsa e ela ficou esperando
 * "Registrar pagamento"; depois alguém percebe que o paciente é de pacote e faz o vínculo
 * pela agenda. O pacote já foi pago — deixar a cobrança pendente cobraria duas vezes a
 * mesma sessão e ainda seguraria o paciente no gate de pagamento da fila.
 *
 * O tratamento é o mesmo do vínculo retroativo do financeiro: a linha vira **paga**, com o
 * valor que a sessão de pacote deve lançar (R$ 0,00 em `unico`, o valor por sessão em
 * `por_sessao`) e a descrição que a identifica como sessão de pacote — é esse prefixo que o
 * filtro avulsa/pacote e o resumo usam para classificar. Nada de `payments`: não houve
 * recebimento novo, o dinheiro está na venda do pacote.
 *
 * Devolve os ids quitados para o chamador liberar a fila e registrar na auditoria.
 */
export async function settlePendingChargesForAppointment(
  supabase: DB,
  clinicId: string,
  input: { appointmentId: string; patientPackageSessionId?: string | null }
): Promise<string[]> {
  const { data: pending, error } = await supabase
    .from("financial_transactions")
    .select("id, category")
    .eq("clinic_id", clinicId)
    .eq("appointment_id", input.appointmentId)
    .eq("type", "receita")
    .in("status", ["pendente", "atrasado"])
  if (error) throw error
  if (!pending || pending.length === 0) return []

  const amount = await packageSessionAmount(supabase, input.patientPackageSessionId)

  const settled: string[] = []
  for (const transaction of pending) {
    const { error: updateError } = await supabase
      .from("financial_transactions")
      .update({
        status: "pago",
        amount,
        description: `Sessão de pacote — ${transaction.category ?? "Atendimento"}`,
      })
      .eq("clinic_id", clinicId)
      .eq("id", transaction.id)
    if (updateError) throw updateError
    settled.push(transaction.id)
  }

  return settled
}

/**
 * Vínculo retroativo (requisito 6): liga um lançamento antigo (as sessões de pacote que
 * ficaram registradas como avulso de R$ 1 ou menos) a um pacote — novo ou já existente —
 * numa posição escolhida.
 *
 * O lançamento continua **pago** — o atendimento aconteceu e foi quitado, cancelar
 * reescreveria a história. O que muda é o valor (vai a zero: o dinheiro real está na venda
 * do pacote, o R$ 1 era um marcador) e a descrição, que passa a identificá-lo como sessão
 * de pacote — é esse prefixo que o filtro avulsa/pacote e o resumo do financeiro usam para
 * classificar a linha.
 */
export async function linkRetroactiveSession(
  supabase: DB,
  clinicId: string,
  input: { transactionId: string; patientPackageId: string; sessionNumber: number }
) {
  const { data: transaction, error: txError } = await supabase
    .from("financial_transactions")
    .select("id, appointment_id, category")
    .eq("clinic_id", clinicId)
    .eq("id", input.transactionId)
    .single()
  if (txError) throw txError

  const { error: sessionError } = await supabase.from("patient_package_sessions").insert({
    patient_package_id: input.patientPackageId,
    appointment_id: transaction.appointment_id,
    session_number: input.sessionNumber,
    status: "consumed",
    consumed_at: new Date().toISOString(),
  })
  if (sessionError) throw sessionError

  const { error: updateError } = await supabase
    .from("financial_transactions")
    .update({
      status: "pago",
      amount: 0,
      description: `Sessão de pacote — ${transaction.category ?? "Atendimento"}`,
    })
    .eq("clinic_id", clinicId)
    .eq("id", input.transactionId)
  if (updateError) throw updateError
}
