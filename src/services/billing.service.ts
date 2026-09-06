import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { BillingPayer, Database } from "@/types/supabase"

type DB = SupabaseClient<Database>

export type BillingType = Database["public"]["Tables"]["billing_types"]["Row"]

export type BillingTypeInput = {
  name: string
  payer: BillingPayer
  amount_per_guide?: number | null
  fallback_amount?: number | null
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  notes?: string | null
}

export type BillingTypeView = BillingType & {
  /** Autorizações ativas usando este tipo — o que impede desativá-lo sem perceber. */
  authorizationsInUse: number
}

/**
 * Tipos de cobrança da clínica.
 *
 * O que distingue um do outro é **quem paga**, não o nome:
 *
 *   `paciente`  particular — paga no ato, no balcão
 *   `convenio`  terceiro paga depois, em lote, contra um protocolo
 *   `ninguem`   cortesia — o atendimento acontece e não gera dívida de ninguém
 *
 * É por isso que `amount_per_guide` e `fallback_amount` só existem no modo convênio: o
 * primeiro é o que o convênio paga por atendimento, o segundo é o que o PACIENTE paga
 * quando o saldo de guias dele acabou.
 */
export async function listBillingTypes(
  supabase: DB,
  clinicId: string,
  opts: { activeOnly?: boolean } = {}
): Promise<BillingTypeView[]> {
  let query = supabase
    .from("billing_types")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("name")

  if (opts.activeOnly) query = query.eq("active", true)

  const { data, error } = await query
  if (error) throw error

  const tipos = data ?? []
  if (tipos.length === 0) return []

  // Contagem em passo próprio: o PostgREST não agrega, e `types/supabase.ts` é escrito à
  // mão com `Relationships: []`, então embed aqui não teria tipagem nenhuma.
  const { data: autorizacoes } = await supabase
    .from("patient_guide_authorizations")
    .select("billing_type_id")
    .eq("clinic_id", clinicId)

  const emUso = new Map<string, number>()
  for (const a of autorizacoes ?? []) {
    emUso.set(a.billing_type_id, (emUso.get(a.billing_type_id) ?? 0) + 1)
  }

  return tipos.map((t) => ({ ...t, authorizationsInUse: emUso.get(t.id) ?? 0 }))
}

export async function getBillingType(
  supabase: DB,
  clinicId: string,
  id: string
): Promise<BillingType | null> {
  const { data, error } = await supabase
    .from("billing_types")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Os valores só são gravados no modo em que fazem sentido.
 *
 * Um particular com `amount_per_guide` preenchido seria um número sem significado esperando
 * para confundir alguém depois — e, pior, para ser lido por engano por uma tela futura.
 */
function normalizar(input: BillingTypeInput) {
  const ehConvenio = input.payer === "convenio"
  return {
    name: input.name,
    payer: input.payer,
    amount_per_guide: ehConvenio ? (input.amount_per_guide ?? null) : null,
    fallback_amount: ehConvenio ? (input.fallback_amount ?? null) : null,
    contact_name: ehConvenio ? (input.contact_name ?? null) : null,
    contact_email: ehConvenio ? (input.contact_email ?? null) : null,
    contact_phone: ehConvenio ? (input.contact_phone ?? null) : null,
    notes: input.notes ?? null,
  }
}

export async function createBillingType(
  supabase: DB,
  clinicId: string,
  input: BillingTypeInput
): Promise<string> {
  const { data, error } = await supabase
    .from("billing_types")
    .insert({ clinic_id: clinicId, ...normalizar(input) })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

export async function updateBillingType(
  supabase: DB,
  clinicId: string,
  id: string,
  input: BillingTypeInput
): Promise<void> {
  const { error } = await supabase
    .from("billing_types")
    .update(normalizar(input))
    .eq("clinic_id", clinicId)
    .eq("id", id)
  if (error) throw error
}

export async function setBillingTypeActive(
  supabase: DB,
  clinicId: string,
  id: string,
  active: boolean
): Promise<void> {
  const { error } = await supabase
    .from("billing_types")
    .update({ active })
    .eq("clinic_id", clinicId)
    .eq("id", id)
  if (error) throw error
}
