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

export type Specialty = {
  id: string
  name: string
  description: string | null
  active: boolean
}

/**
 * Todas as especialidades, inclusive as inativas — a tela de gestão precisa mostrar e
 * reativar o que foi desativado, ao contrário de listSpecialties(), que serve aos seletores
 * de cadastro e por isso devolve só as ativas.
 */
export async function listAllSpecialties(
  supabase: DB,
  clinicId: string
): Promise<Specialty[]> {
  const { data, error } = await supabase
    .from("specialties")
    .select("id, name, description, active")
    .eq("clinic_id", clinicId)
    .order("name")
  if (error) throw error
  return data as Specialty[]
}

export async function createSpecialty(
  supabase: DB,
  clinicId: string,
  input: { name: string; description: string | null }
) {
  const { data, error } = await supabase
    .from("specialties")
    .insert({ clinic_id: clinicId, name: input.name, description: input.description })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

export async function updateSpecialty(
  supabase: DB,
  clinicId: string,
  specialtyId: string,
  input: { name: string; description: string | null }
) {
  // Filtrado por clinic_id além do id: a RLS de specialties é `for all using
  // has_clinic_access`, então ela prova que o chamador pertence a ALGUMA clínica, não que a
  // linha seja desta. Sem este filtro, um id de outro tenant passaria.
  const { error } = await supabase
    .from("specialties")
    .update({ name: input.name, description: input.description })
    .eq("id", specialtyId)
    .eq("clinic_id", clinicId)
  if (error) throw error
}

/**
 * Desativa em vez de apagar. `professionals.specialty_id` referencia esta tabela, então um
 * delete falharia para qualquer especialidade em uso — e apagar uma sem uso ainda assim
 * sumiria com o histórico de quem já foi cadastrado com ela.
 */
export async function setSpecialtyActive(
  supabase: DB,
  clinicId: string,
  specialtyId: string,
  active: boolean
) {
  const { error } = await supabase
    .from("specialties")
    .update({ active })
    .eq("id", specialtyId)
    .eq("clinic_id", clinicId)
  if (error) throw error
}
