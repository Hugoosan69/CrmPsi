import "server-only"

import type { Database } from "@/types/supabase"
import type { SupabaseClient } from "@supabase/supabase-js"

type DB = SupabaseClient<Database>

export type Insurer = Database["public"]["Tables"]["insurers"]["Row"]

export type InsurerInput = {
  name: string
  /** NULL = sem limite. Ver o comentário da coluna na migration 032. */
  max_guides_per_patient_month: number | null
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  notes?: string | null
}

export type InsurerView = Insurer & {
  /** Atendimentos já marcados para este convênio — o que dá peso a inativá-lo. */
  appointmentsCount: number
  /** Procedimentos que este convênio cobre. Vazio = cobre qualquer um. */
  procedureIds: string[]
}

/**
 * Os convênios com quem a clínica fatura.
 *
 * O tipo de cobrança do atendimento diz SE é convênio; esta tabela diz QUAL. O convênio não
 * guarda mais quanto paga (migration 032): isso só se sabe quando ele paga, e vive em
 * `service_guides.paid_amount`. O que ele guarda são as duas regras que a clínica precisa
 * fazer valer na hora do atendimento — quantas guias por paciente no mês, e que
 * procedimentos ele cobre.
 */
export async function listInsurers(
  supabase: DB,
  clinicId: string,
  opts: { activeOnly?: boolean } = {}
): Promise<InsurerView[]> {
  let query = supabase.from("insurers").select("*").eq("clinic_id", clinicId).order("name")
  if (opts.activeOnly) query = query.eq("active", true)

  const { data, error } = await query
  if (error) throw error

  const convenios = data ?? []
  if (convenios.length === 0) return []

  // Passos próprios: o PostgREST não agrega, e `types/supabase.ts` é escrito à mão com
  // `Relationships: []`, então embed aqui não teria tipagem nenhuma.
  const [{ data: agendamentos }, { data: vinculos }] = await Promise.all([
    supabase
      .from("appointments")
      .select("insurer_id")
      .eq("clinic_id", clinicId)
      .not("insurer_id", "is", null),
    supabase
      .from("insurer_procedures")
      .select("insurer_id, procedure_id")
      .eq("clinic_id", clinicId),
  ])

  const contagem = new Map<string, number>()
  for (const a of agendamentos ?? []) {
    if (a.insurer_id) contagem.set(a.insurer_id, (contagem.get(a.insurer_id) ?? 0) + 1)
  }

  const procedimentosPorConvenio = new Map<string, string[]>()
  for (const v of vinculos ?? []) {
    const atual = procedimentosPorConvenio.get(v.insurer_id) ?? []
    atual.push(v.procedure_id)
    procedimentosPorConvenio.set(v.insurer_id, atual)
  }

  return convenios.map((c) => ({
    ...c,
    appointmentsCount: contagem.get(c.id) ?? 0,
    procedureIds: procedimentosPorConvenio.get(c.id) ?? [],
  }))
}

/**
 * Só os ativos, para o seletor do pagamento.
 *
 * Traz `procedureIds` junto porque quem chama precisa dos dois na mesma decisão: a tela de
 * pagamento oferece apenas os convênios que cobrem o procedimento daquele atendimento, e
 * buscar o vínculo num segundo momento faria a lista piscar entre "todos" e "os certos".
 */
export async function listActiveInsurers(
  supabase: DB,
  clinicId: string
): Promise<InsurerView[]> {
  return listInsurers(supabase, clinicId, { activeOnly: true })
}

export async function getInsurer(
  supabase: DB,
  clinicId: string,
  id: string
): Promise<Insurer | null> {
  const { data, error } = await supabase
    .from("insurers")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createInsurer(
  supabase: DB,
  clinicId: string,
  input: InsurerInput,
  procedureIds: string[] = []
): Promise<string> {
  const { data, error } = await supabase
    .from("insurers")
    .insert({ clinic_id: clinicId, ...input })
    .select("id")
    .single()
  if (error) throw error
  await replaceInsurerProcedures(supabase, clinicId, data.id, procedureIds)
  return data.id
}

export async function updateInsurer(
  supabase: DB,
  clinicId: string,
  id: string,
  input: InsurerInput,
  procedureIds: string[] = []
): Promise<void> {
  const { error } = await supabase
    .from("insurers")
    .update(input)
    .eq("clinic_id", clinicId)
    .eq("id", id)
  if (error) throw error
  await replaceInsurerProcedures(supabase, clinicId, id, procedureIds)
}

/**
 * Troca a lista de procedimentos cobertos pelo convênio.
 *
 * Apaga e reinsere em vez de calcular o diff: a lista tem dezenas de linhas no pior caso, e
 * o diff traria a única parte difícil (descobrir o que saiu) sem trazer benefício nenhum.
 *
 * O apaga-reinsere NÃO é transacional aqui, e isso é aceitável porque a tabela só responde
 * "que convênios oferecer nesta tela": uma falha entre as duas chamadas deixa o convênio
 * momentaneamente cobrindo tudo, que é o mesmo estado de um convênio recém-cadastrado.
 * Nada de dinheiro depende dela — guia emitida guarda o convênio na própria linha.
 */
async function replaceInsurerProcedures(
  supabase: DB,
  clinicId: string,
  insurerId: string,
  procedureIds: string[]
): Promise<void> {
  const { error: erroApagar } = await supabase
    .from("insurer_procedures")
    .delete()
    .eq("clinic_id", clinicId)
    .eq("insurer_id", insurerId)
  if (erroApagar) throw erroApagar

  const unicos = [...new Set(procedureIds)].filter(Boolean)
  if (unicos.length === 0) return

  const { error } = await supabase.from("insurer_procedures").insert(
    unicos.map((procedure_id) => ({ clinic_id: clinicId, insurer_id: insurerId, procedure_id }))
  )
  if (error) throw error
}

/**
 * Quantas guias este paciente já tem neste convênio, no mês da data informada.
 *
 * Passa pela função SQL da migration 032 e não por uma consulta montada aqui porque a
 * mesma contagem é feita em dois momentos — a tela mostra o saldo, a Server Action bloqueia
 * — e duas versões da regra acabariam divergindo. A que bloqueia é a que vale.
 */
export async function guidesUsedInMonth(
  supabase: DB,
  clinicId: string,
  patientId: string,
  insurerId: string,
  reference: string
): Promise<number> {
  const { data, error } = await supabase.rpc("insurer_guides_used_in_month", {
    p_clinic: clinicId,
    p_patient: patientId,
    p_insurer: insurerId,
    p_reference: reference,
  })
  if (error) throw error
  return data ?? 0
}

export async function setInsurerActive(
  supabase: DB,
  clinicId: string,
  id: string,
  active: boolean
): Promise<void> {
  const { error } = await supabase
    .from("insurers")
    .update({ active })
    .eq("clinic_id", clinicId)
    .eq("id", id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Guias de atendimento
// ---------------------------------------------------------------------------

export type ServiceGuide = Database["public"]["Tables"]["service_guides"]["Row"]

export type IssueGuideInput = {
  appointmentId: string
  insurerId: string
  guideNumber: string
  fileId?: string | null
  attachmentUrl?: string | null
  createdBy: string
}

/**
 * Emite a guia de um atendimento.
 *
 * Sem valor desde a migration 032: a guia é o comprovante de que o atendimento aconteceu, e
 * quanto o convênio pagou por ela só se sabe no acerto — é `paid_amount`, preenchido na
 * baixa. Guardar aqui um valor "combinado" era guardar um palpite que ninguém conferia.
 */
export async function issueServiceGuide(
  supabase: DB,
  clinicId: string,
  input: IssueGuideInput
): Promise<ServiceGuide> {
  const { data, error } = await supabase
    .from("service_guides")
    .insert({
      clinic_id: clinicId,
      appointment_id: input.appointmentId,
      insurer_id: input.insurerId,
      guide_number: input.guideNumber,
      file_id: input.fileId ?? null,
      attachment_url: input.attachmentUrl ?? null,
      created_by: input.createdBy,
    })
    .select("*")
    .single()
  if (error) throw error
  return data
}

/** A guia viva de um atendimento, se houver. */
export async function getGuideForAppointment(
  supabase: DB,
  clinicId: string,
  appointmentId: string
): Promise<ServiceGuide | null> {
  const { data, error } = await supabase
    .from("service_guides")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("appointment_id", appointmentId)
    .neq("status", "cancelada")
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Marca o atendimento como sendo de convênio.
 *
 * Fica em `appointments` e não só na guia porque é o atendimento que a agenda mostra e que
 * o relatório mensal percorre — e porque o CHECK da migration 029 exige os dois juntos.
 */
export async function markAppointmentAsInsured(
  supabase: DB,
  clinicId: string,
  appointmentId: string,
  insurerId: string
): Promise<void> {
  const { error } = await supabase
    .from("appointments")
    .update({ billing_kind: "convenio", insurer_id: insurerId })
    .eq("clinic_id", clinicId)
    .eq("id", appointmentId)
  if (error) throw error
}

export type GuideDetail = {
  guideNumber: string | null
  insurerName: string
  /** Só as guias anteriores à migration 032 têm valor. Ver `issueServiceGuide`. */
  amount: number | null
  status: string
  fileId: string | null
  attachmentUrl: string | null
}

/**
 * A guia de um conjunto de atendimentos, por atendimento.
 *
 * Usada pelo financeiro para mostrar o número da guia no detalhe do lançamento — o nome do
 * convênio sai do cadastro de agora, não de texto congelado, como o resto do sistema.
 */
export async function guidesByAppointment(
  supabase: DB,
  clinicId: string,
  appointmentIds: string[]
): Promise<Map<string, GuideDetail>> {
  const ids = [...new Set(appointmentIds)]
  if (ids.length === 0) return new Map()

  const { data: guias } = await supabase
    .from("service_guides")
    .select("appointment_id, guide_number, insurer_id, amount, status, file_id, attachment_url")
    .eq("clinic_id", clinicId)
    .in("appointment_id", ids)
    .neq("status", "cancelada")

  if (!guias || guias.length === 0) return new Map()

  const { data: convenios } = await supabase
    .from("insurers")
    .select("id, name")
    .eq("clinic_id", clinicId)
    .in("id", [...new Set(guias.map((g) => g.insurer_id))])

  const nomePorConvenio = new Map((convenios ?? []).map((c) => [c.id, c.name]))

  const out = new Map<string, GuideDetail>()
  for (const g of guias) {
    out.set(g.appointment_id, {
      guideNumber: g.guide_number,
      insurerName: nomePorConvenio.get(g.insurer_id) ?? "Convênio",
      amount: g.amount === null ? null : Number(g.amount),
      status: g.status,
      fileId: g.file_id,
      attachmentUrl: g.attachment_url,
    })
  }
  return out
}
