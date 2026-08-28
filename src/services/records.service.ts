import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/supabase"

type DB = SupabaseClient<Database>

export type MedicalRecordInput = {
  chief_complaint?: string | null
  history?: string | null
  exam?: string | null
  assessment?: string | null
  plan?: string | null
  notes?: string | null
}

export async function getMedicalRecordByQueueEntry(supabase: DB, queueEntryId: string) {
  const { data, error } = await supabase
    .from("medical_records")
    .select("*")
    .eq("queue_entry_id", queueEntryId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getOrCreateMedicalRecordForQueueEntry(
  supabase: DB,
  clinicId: string,
  input: { queueEntryId: string; patientId: string; professionalId: string; appointmentId: string | null }
) {
  const existing = await getMedicalRecordByQueueEntry(supabase, input.queueEntryId)
  if (existing) return existing

  const { data, error } = await supabase
    .from("medical_records")
    .insert({
      clinic_id: clinicId,
      patient_id: input.patientId,
      professional_id: input.professionalId,
      appointment_id: input.appointmentId,
      queue_entry_id: input.queueEntryId,
    })
    .select("*")
    .single()
  if (error) throw error
  return data
}

export async function updateMedicalRecord(
  supabase: DB,
  clinicId: string,
  medicalRecordId: string,
  input: MedicalRecordInput
) {
  const { error } = await supabase
    .from("medical_records")
    .update(input)
    .eq("clinic_id", clinicId)
    .eq("id", medicalRecordId)
  if (error) throw error
}

export async function listMedicalRecordsForPatient(supabase: DB, clinicId: string, patientId: string) {
  const { data, error } = await supabase
    .from("medical_records")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function listDiagnosesForRecord(supabase: DB, medicalRecordId: string) {
  const { data, error } = await supabase
    .from("record_diagnoses")
    .select("*")
    .eq("medical_record_id", medicalRecordId)
  if (error) throw error
  return data ?? []
}

export async function listDiagnosesForRecords(supabase: DB, medicalRecordIds: string[]) {
  if (medicalRecordIds.length === 0) return []
  const { data, error } = await supabase
    .from("record_diagnoses")
    .select("*")
    .in("medical_record_id", medicalRecordIds)
  if (error) throw error
  return data ?? []
}

export async function addDiagnosis(
  supabase: DB,
  input: { medicalRecordId: string; cidCode: string; isPrimary: boolean }
) {
  const { error } = await supabase.from("record_diagnoses").insert({
    medical_record_id: input.medicalRecordId,
    cid_code: input.cidCode,
    is_primary: input.isPrimary,
  })
  if (error) throw error
}

export async function removeDiagnosis(supabase: DB, diagnosisId: string) {
  const { error } = await supabase.from("record_diagnoses").delete().eq("id", diagnosisId)
  if (error) throw error
}

export async function searchCidCodes(supabase: DB, query: string) {
  if (!query || query.trim().length < 2) return []
  const { data, error } = await supabase
    .from("cid_codes")
    .select("code, description")
    .or(`code.ilike.%${query}%,description.ilike.%${query}%`)
    .limit(20)
  if (error) throw error
  return data ?? []
}

export async function getCidDescriptions(supabase: DB, codes: string[]) {
  if (codes.length === 0) return new Map<string, string>()
  const { data, error } = await supabase.from("cid_codes").select("code, description").in("code", codes)
  if (error) throw error
  return new Map((data ?? []).map((c) => [c.code, c.description]))
}

export type PrintableRecord = {
  id: string
  chief_complaint: string | null
  history: string | null
  exam: string | null
  assessment: string | null
  plan: string | null
  notes: string | null
  created_at: string
  patient: { full_name: string; social_name: string | null; cpf: string | null; birth_date: string | null }
  professional: { full_name: string; professional_register: string | null; specialty: string | null }
}

/**
 * Prontuário com paciente e profissional para impressão.
 *
 * Filtrado por clinic_id além do id: a RLS destas tabelas prova apenas que o chamador
 * pertence a ALGUMA clínica, então sem este filtro um id de outro tenant seria impresso.
 */
export async function getPrintableRecord(
  supabase: DB,
  clinicId: string,
  recordId: string
): Promise<PrintableRecord | null> {
  const { data, error } = await supabase
    .from("medical_records")
    .select(
      `id, chief_complaint, history, exam, assessment, plan, notes, created_at,
       patients(full_name, social_name, cpf, birth_date),
       professionals(full_name, professional_register, specialties(name))`
    )
    .eq("id", recordId)
    .eq("clinic_id", clinicId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const p = data.patients as unknown as PrintableRecord["patient"]
  const pro = data.professionals as unknown as {
    full_name: string
    professional_register: string | null
    specialties: { name: string } | null
  }

  return {
    id: data.id,
    chief_complaint: data.chief_complaint,
    history: data.history,
    exam: data.exam,
    assessment: data.assessment,
    plan: data.plan,
    notes: data.notes,
    created_at: data.created_at,
    patient: p,
    professional: {
      full_name: pro?.full_name ?? "",
      professional_register: pro?.professional_register ?? null,
      specialty: pro?.specialties?.name ?? null,
    },
  }
}
