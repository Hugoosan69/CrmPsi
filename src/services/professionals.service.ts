import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/supabase"

type DB = SupabaseClient<Database>

export type ProfessionalInput = {
  full_name: string
  professional_register?: string | null
  specialty_id?: string | null
  phone?: string | null
  email?: string | null
  color?: string
}

export async function listSpecialties(supabase: DB, clinicId: string) {
  const { data, error } = await supabase
    .from("specialties")
    .select("id, name")
    .eq("clinic_id", clinicId)
    .eq("active", true)
    .order("name")
  if (error) throw error
  return data
}

export async function getProfessionalByUserId(supabase: DB, clinicId: string, userId: string) {
  const { data, error } = await supabase
    .from("professionals")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function listProfessionals(supabase: DB, clinicId: string) {
  const { data, error } = await supabase
    .from("professionals")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("full_name")
  if (error) throw error
  return data
}

export async function createProfessional(supabase: DB, clinicId: string, input: ProfessionalInput) {
  const { error } = await supabase.from("professionals").insert({ ...input, clinic_id: clinicId })
  if (error) throw error
}

export async function updateProfessional(
  supabase: DB,
  clinicId: string,
  professionalId: string,
  input: Partial<ProfessionalInput>
) {
  const { error } = await supabase
    .from("professionals")
    .update(input)
    .eq("clinic_id", clinicId)
    .eq("id", professionalId)
  if (error) throw error
}

export async function setProfessionalActive(
  supabase: DB,
  clinicId: string,
  professionalId: string,
  active: boolean
) {
  const { error } = await supabase
    .from("professionals")
    .update({ active })
    .eq("clinic_id", clinicId)
    .eq("id", professionalId)
  if (error) throw error
}
