import "server-only"

import type { Database } from "@/types/supabase"
import type { SupabaseClient } from "@supabase/supabase-js"

type DB = SupabaseClient<Database>

export type Insurer = Database["public"]["Tables"]["insurers"]["Row"]

export type InsurerInput = {
  name: string
  amount_per_guide: number
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  notes?: string | null
}

export type InsurerView = Insurer & {
  /** Atendimentos já marcados para este convênio — o que dá peso a inativá-lo. */
  appointmentsCount: number
}

/**
 * Os convênios com quem a clínica fatura.
 *
 * O tipo de cobrança do atendimento diz SE é convênio; esta tabela diz QUAL. `amount_per_guide`
 * é o que o convênio paga por atendimento (CABEN: R$ 60) — e é só isso que ele paga: a
 * diferença, quando existe, é cobrada do paciente como avulso, num lançamento à parte.
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

  // Passo próprio: o PostgREST não agrega, e `types/supabase.ts` é escrito à mão com
  // `Relationships: []`, então embed aqui não teria tipagem nenhuma.
  const { data: agendamentos } = await supabase
    .from("appointments")
    .select("insurer_id")
    .eq("clinic_id", clinicId)
    .not("insurer_id", "is", null)

  const contagem = new Map<string, number>()
  for (const a of agendamentos ?? []) {
    if (a.insurer_id) contagem.set(a.insurer_id, (contagem.get(a.insurer_id) ?? 0) + 1)
  }

  return convenios.map((c) => ({ ...c, appointmentsCount: contagem.get(c.id) ?? 0 }))
}

/** Só os ativos, para o seletor do agendamento. */
export async function listActiveInsurers(supabase: DB, clinicId: string): Promise<Insurer[]> {
  const { data, error } = await supabase
    .from("insurers")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("active", true)
    .order("name")
  if (error) throw error
  return data ?? []
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
  input: InsurerInput
): Promise<string> {
  const { data, error } = await supabase
    .from("insurers")
    .insert({ clinic_id: clinicId, ...input })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

export async function updateInsurer(
  supabase: DB,
  clinicId: string,
  id: string,
  input: InsurerInput
): Promise<void> {
  const { error } = await supabase
    .from("insurers")
    .update(input)
    .eq("clinic_id", clinicId)
    .eq("id", id)
  if (error) throw error
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
  /** O que o convênio paga — cópia do valor vigente na emissão. */
  amount: number
  fileId?: string | null
  attachmentUrl?: string | null
  createdBy: string
}

/**
 * Emite a guia de um atendimento.
 *
 * O valor é COPIADO do convênio na emissão, não lido dele depois: o combinado muda com o
 * tempo, e um protocolo já enviado não pode mudar junto. É a mesma razão pela qual
 * `patient_packages` guarda o preço da venda.
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
      amount: input.amount,
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
  amount: number
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
      amount: Number(g.amount),
      status: g.status,
      fileId: g.file_id,
      attachmentUrl: g.attachment_url,
    })
  }
  return out
}
