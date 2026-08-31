import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/supabase"
import { fetchPage } from "@/lib/paginated-query"

type DB = SupabaseClient<Database>

export type PatientInput = {
  full_name: string
  social_name?: string | null
  cpf?: string | null
  birth_date?: string | null
  sex?: string | null
  phone?: string | null
  whatsapp?: string | null
  email?: string | null
  mother_name?: string | null
  notes?: string | null
}

/**
 * Página de pacientes, com o total para a barra de navegação.
 *
 * Antes devolvia no máximo 50 linhas, sem dizer que havia mais. A recepção que buscasse por
 * um sobrenome comum via a lista parar no meio do alfabeto e não tinha como saber se o
 * paciente não existia ou só não tinha cabido. `count: "exact"` custa uma contagem no banco,
 * e é ela que permite dizer "26–50 de 812" em vez de mentir por omissão.
 */
export async function listPatients(
  supabase: DB,
  clinicId: string,
  opts: {
    search?: string
    activeOnly?: boolean
    offset?: number
    rangeEnd?: number
  } = {}
): Promise<{ rows: Database["public"]["Tables"]["patients"]["Row"][]; total: number }> {
  // Função, não consulta pronta: o construtor do supabase-js muta a si mesmo, então guardar
  // "a versão sem faixa" numa variável não guarda nada. Ver lib/paginated-query.
  const construir = () => {
    let query = supabase
      .from("patients")
      .select("*", { count: "exact" })
      .eq("clinic_id", clinicId)
      .order("full_name")

    if (opts.activeOnly ?? true) {
      query = query.eq("active", true)
    }

    const search = opts.search?.trim()
    if (search) {
      const digits = search.replace(/\D/g, "")
      const orFilters = [
        `full_name.ilike.%${search}%`,
        `phone.ilike.%${search}%`,
        `whatsapp.ilike.%${search}%`,
      ]
      if (digits) orFilters.push(`cpf.ilike.%${digits}%`)
      query = query.or(orFilters.join(","))
    }
    return query
  }

  return fetchPage(construir, opts)
}

export async function getPatient(supabase: DB, clinicId: string, patientId: string) {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("id", patientId)
    .single()
  if (error) throw error
  return data
}

export async function getPatientClinicalInfo(supabase: DB, patientId: string) {
  const { data, error } = await supabase
    .from("patient_clinical_info")
    .select("*")
    .eq("patient_id", patientId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createPatient(
  supabase: DB,
  clinicId: string,
  createdBy: string,
  input: PatientInput
) {
  const { data, error } = await supabase
    .from("patients")
    .insert({ ...input, clinic_id: clinicId, created_by: createdBy })
    .select("id")
    .single()
  if (error) throw error
  return data
}

export async function updatePatient(
  supabase: DB,
  clinicId: string,
  patientId: string,
  input: Partial<PatientInput>
) {
  const { error } = await supabase
    .from("patients")
    .update(input)
    .eq("clinic_id", clinicId)
    .eq("id", patientId)
  if (error) throw error
}

export type PatientClinicalInfoInput = {
  allergies?: string[] | null
  chronic_conditions?: string[] | null
  current_medications?: string[] | null
  relevant_history?: string | null
}

export async function upsertPatientClinicalInfo(
  supabase: DB,
  patientId: string,
  input: PatientClinicalInfoInput
) {
  const { error } = await supabase
    .from("patient_clinical_info")
    .upsert({ patient_id: patientId, ...input })
  if (error) throw error
}

export async function setPatientActive(
  supabase: DB,
  clinicId: string,
  patientId: string,
  active: boolean
) {
  const { error } = await supabase
    .from("patients")
    .update({ active })
    .eq("clinic_id", clinicId)
    .eq("id", patientId)
  if (error) throw error
}
