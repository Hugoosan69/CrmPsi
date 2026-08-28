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

export type PrintableDocument = {
  id: string
  type: string
  content: string
  issued_at: string
  patient: { full_name: string; social_name: string | null; cpf: string | null }
  professional: { full_name: string; professional_register: string | null; specialty: string | null }
}

/** Documento emitido, com paciente e profissional, para impressão. Filtrado por clinic_id
 *  além do id — a RLS prova apenas que o chamador pertence a alguma clínica. */
export async function getPrintableDocument(
  supabase: DB,
  clinicId: string,
  documentId: string
): Promise<PrintableDocument | null> {
  const { data, error } = await supabase
    .from("clinical_documents")
    .select(
      `id, type, content, issued_at,
       patients(full_name, social_name, cpf),
       professionals(full_name, professional_register, specialties(name))`
    )
    .eq("id", documentId)
    .eq("clinic_id", clinicId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const pro = data.professionals as unknown as {
    full_name: string
    professional_register: string | null
    specialties: { name: string } | null
  }

  return {
    id: data.id,
    type: data.type as string,
    content: data.content,
    issued_at: data.issued_at,
    patient: data.patients as unknown as PrintableDocument["patient"],
    professional: {
      full_name: pro?.full_name ?? "",
      professional_register: pro?.professional_register ?? null,
      specialty: pro?.specialties?.name ?? null,
    },
  }
}
