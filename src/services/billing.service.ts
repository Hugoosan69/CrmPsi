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

// ---------------------------------------------------------------------------
// Listagem de guias
// ---------------------------------------------------------------------------

export type GuideRow = {
  id: string
  guideNumber: string | null
  status: string
  issuedAt: string
  insurerId: string
  insurerName: string
  patientId: string | null
  patientName: string
  appointmentId: string
  scheduledAt: string | null
  professionalName: string | null
  procedureName: string | null
  specialtyName: string | null
  /** Chave do objeto no R2, quando há anexo. O link é assinado sob demanda. */
  attachmentKey: string | null
}

export type GuideStatus = Database["public"]["Enums"]["service_guide_status"]

export type GuideFilters = {
  /** Uma guia só, já com todos os nomes resolvidos. */
  id?: string
  patientId?: string
  insurerId?: string
  /** Primeiro dia do mês de referência, "YYYY-MM-DD". */
  month?: string
  status?: GuideStatus
}

/**
 * As guias emitidas, já com os nomes que a tela mostra.
 *
 * Uma função só para a ficha do paciente e para a listagem geral, porque a diferença entre
 * as duas é um filtro — e duas consultas quase iguais divergiriam no primeiro ajuste. A
 * ficha passa `patientId`; a tela de gestão passa mês e convênio, ou nada.
 *
 * Tudo por leitura indexada em vez de embed: `types/supabase.ts` é escrito à mão com
 * `Relationships: []`, então um embed do PostgREST aqui não teria tipagem nenhuma.
 *
 * Os nomes saem do cadastro de AGORA — convênio, procedimento, profissional, paciente. É a
 * mesma regra do resto do sistema: renomear um convênio muda todas as telas que o mostram,
 * sem reprocessar nada. O que fica congelado na guia é só o número dela.
 */
export async function listGuides(
  supabase: DB,
  clinicId: string,
  filters: GuideFilters = {}
): Promise<GuideRow[]> {
  // O paciente não está em `service_guides`: a guia é do ATENDIMENTO, e é o atendimento que
  // aponta o paciente. Filtrar por paciente exige, portanto, saber antes quais atendimentos
  // são dele.
  let appointmentIdsDoPaciente: string[] | null = null
  if (filters.patientId) {
    const { data } = await supabase
      .from("appointments")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("patient_id", filters.patientId)
    appointmentIdsDoPaciente = (data ?? []).map((a) => a.id)
    if (appointmentIdsDoPaciente.length === 0) return []
  }

  let query = supabase
    .from("service_guides")
    .select(
      "id, guide_number, status, issued_at, insurer_id, appointment_id, attachment_url"
    )
    .eq("clinic_id", clinicId)
    .neq("status", "cancelada")
    .order("issued_at", { ascending: false })

  if (filters.id) query = query.eq("id", filters.id)
  if (appointmentIdsDoPaciente) query = query.in("appointment_id", appointmentIdsDoPaciente)
  if (filters.insurerId) query = query.eq("insurer_id", filters.insurerId)
  if (filters.status) query = query.eq("status", filters.status)
  if (filters.month) {
    // Mês fechado pelo início do seguinte: `lt` e não `lte` para não incluir, por um
    // instante, a primeira guia do mês que vem.
    const inicio = new Date(`${filters.month}T00:00:00-03:00`)
    const fim = new Date(inicio)
    fim.setMonth(fim.getMonth() + 1)
    query = query.gte("issued_at", inicio.toISOString()).lt("issued_at", fim.toISOString())
  }

  const { data: guias, error } = await query
  if (error) throw error
  if (!guias || guias.length === 0) return []

  const appointmentIds = [...new Set(guias.map((g) => g.appointment_id))]
  const insurerIds = [...new Set(guias.map((g) => g.insurer_id))]

  const [{ data: convenios }, { data: atendimentos }] = await Promise.all([
    supabase.from("insurers").select("id, name").in("id", insurerIds),
    supabase
      .from("appointments")
      .select("id, patient_id, professional_id, procedure_id, scheduled_at")
      .eq("clinic_id", clinicId)
      .in("id", appointmentIds),
  ])

  const patientIds = [...new Set((atendimentos ?? []).map((a) => a.patient_id))]
  const professionalIds = [
    ...new Set((atendimentos ?? []).map((a) => a.professional_id).filter(Boolean)),
  ] as string[]
  const procedureIds = [
    ...new Set((atendimentos ?? []).map((a) => a.procedure_id).filter(Boolean)),
  ] as string[]

  const [{ data: pacientes }, { data: profissionais }, { data: procedimentos }] =
    await Promise.all([
      patientIds.length > 0
        ? supabase.from("patients").select("id, full_name, social_name").in("id", patientIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string; social_name: string | null }[] }),
      professionalIds.length > 0
        ? supabase
            .from("professionals")
            .select("id, full_name, specialty_id")
            .in("id", professionalIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string; specialty_id: string | null }[] }),
      procedureIds.length > 0
        ? supabase.from("procedures").select("id, name").in("id", procedureIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ])

  // A especialidade vem do PROFISSIONAL, não do procedimento: `procedures` não tem
  // `specialty_id`. Supor o contrário já quebrou o filtro do financeiro em silêncio.
  const specialtyIds = [
    ...new Set((profissionais ?? []).map((p) => p.specialty_id).filter(Boolean)),
  ] as string[]
  const { data: especialidades } =
    specialtyIds.length > 0
      ? await supabase.from("specialties").select("id, name").in("id", specialtyIds)
      : { data: [] as { id: string; name: string }[] }

  const convenioPorId = new Map((convenios ?? []).map((c) => [c.id, c.name]))
  const atendimentoPorId = new Map((atendimentos ?? []).map((a) => [a.id, a]))
  const pacientePorId = new Map((pacientes ?? []).map((p) => [p.id, p]))
  const profissionalPorId = new Map((profissionais ?? []).map((p) => [p.id, p]))
  const procedimentoPorId = new Map((procedimentos ?? []).map((p) => [p.id, p.name]))
  const especialidadePorId = new Map((especialidades ?? []).map((e) => [e.id, e.name]))

  return guias.map((g) => {
    const atendimento = atendimentoPorId.get(g.appointment_id)
    const paciente = atendimento ? pacientePorId.get(atendimento.patient_id) : undefined
    const profissional = atendimento?.professional_id
      ? profissionalPorId.get(atendimento.professional_id)
      : undefined
    return {
      id: g.id,
      guideNumber: g.guide_number,
      status: g.status,
      issuedAt: g.issued_at,
      insurerId: g.insurer_id,
      insurerName: convenioPorId.get(g.insurer_id) ?? "Convênio",
      patientId: atendimento?.patient_id ?? null,
      patientName: paciente?.social_name || paciente?.full_name || "—",
      appointmentId: g.appointment_id,
      scheduledAt: atendimento?.scheduled_at ?? null,
      professionalName: profissional?.full_name ?? null,
      procedureName: atendimento?.procedure_id
        ? procedimentoPorId.get(atendimento.procedure_id) ?? null
        : null,
      specialtyName: profissional?.specialty_id
        ? especialidadePorId.get(profissional.specialty_id) ?? null
        : null,
      attachmentKey: g.attachment_url,
    }
  })
}

/** Uma guia, para conferir a permissão antes de gerar o link do anexo. */
export async function getGuide(
  supabase: DB,
  clinicId: string,
  id: string
): Promise<ServiceGuide | null> {
  const { data, error } = await supabase
    .from("service_guides")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Cancela uma guia.
 *
 * `update` e não `delete` — a razão está em `cancelGuideAction`, que é quem decide. Aqui só
 * é preciso saber que o índice de "uma guia viva por atendimento" e a contagem do limite
 * mensal já ignoram as canceladas, então cancelar libera o atendimento e devolve a guia ao
 * saldo do paciente sem apagar o registro.
 */
export async function cancelServiceGuide(
  supabase: DB,
  clinicId: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("service_guides")
    .update({ status: "cancelada" })
    .eq("clinic_id", clinicId)
    .eq("id", id)
  if (error) throw error
}
