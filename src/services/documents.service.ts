import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { ClinicalDocumentType, Database } from "@/types/supabase"

type DB = SupabaseClient<Database>

export async function listDocumentTemplates(supabase: DB, clinicId: string) {
  const { data, error } = await supabase
    .from("document_templates")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("active", true)
    .order("name")
  if (error) throw error
  return data ?? []
}

export async function createClinicalDocument(
  supabase: DB,
  input: {
    clinicId: string
    patientId: string
    professionalId: string
    medicalRecordId: string | null
    templateId: string | null
    type: ClinicalDocumentType
    content: string
  }
) {
  const { data, error } = await supabase
    .from("clinical_documents")
    .insert({
      clinic_id: input.clinicId,
      patient_id: input.patientId,
      professional_id: input.professionalId,
      medical_record_id: input.medicalRecordId,
      template_id: input.templateId,
      type: input.type,
      content: input.content,
    })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

export async function listClinicalDocumentsForPatient(supabase: DB, clinicId: string, patientId: string) {
  const { data, error } = await supabase
    .from("clinical_documents")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .order("issued_at", { ascending: false })
  if (error) throw error
  return data ?? []
}
