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
