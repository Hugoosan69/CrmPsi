import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/supabase"
import { fetchPage } from "@/lib/paginated-query"

type DB = SupabaseClient<Database>

export type ProcedureInput = {
  name: string
  description?: string | null
  duration_minutes: number
  price: number
}

/**
 * Catálogo inteiro — é o que os seletores de agendamento e de fila precisam, e é o uso
 * dominante desta função. A tela de gestão do catálogo usa `listProceduresPage`.
 */
export async function listProcedures(supabase: DB, clinicId: string) {
  const { data, error } = await supabase
    .from("procedures")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("name")
  if (error) throw error
  return data
}

/** Uma página do catálogo, com o total, para a tela de gestão. */
export async function listProceduresPage(
  supabase: DB,
  clinicId: string,
  opts: { offset?: number; rangeEnd?: number } = {}
): Promise<{ rows: Database["public"]["Tables"]["procedures"]["Row"][]; total: number }> {
  return fetchPage(
    () =>
      supabase
        .from("procedures")
        .select("*", { count: "exact" })
        .eq("clinic_id", clinicId)
        .order("name"),
    opts
  )
}

export async function getProcedure(supabase: DB, clinicId: string, procedureId: string) {
  const { data, error } = await supabase
    .from("procedures")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("id", procedureId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createProcedure(supabase: DB, clinicId: string, input: ProcedureInput) {
  const { error } = await supabase.from("procedures").insert({ ...input, clinic_id: clinicId })
  if (error) throw error
}

export async function updateProcedure(
  supabase: DB,
  clinicId: string,
  procedureId: string,
  input: Partial<ProcedureInput>
) {
  const { error } = await supabase
    .from("procedures")
    .update(input)
    .eq("clinic_id", clinicId)
    .eq("id", procedureId)
  if (error) throw error
}

export async function setProcedureActive(
  supabase: DB,
  clinicId: string,
  procedureId: string,
  active: boolean
) {
  const { error } = await supabase
    .from("procedures")
    .update({ active })
    .eq("clinic_id", clinicId)
    .eq("id", procedureId)
  if (error) throw error
}
