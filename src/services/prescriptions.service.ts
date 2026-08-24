import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/supabase"

type DB = SupabaseClient<Database>

export type PrescriptionItemInput = {
  medication_name: string
  concentration?: string | null
  pharmaceutical_form?: string | null
  dose?: string | null
  frequency?: string | null
  duration?: string | null
  quantity?: string | null
  instructions?: string | null
}

export async function createPrescription(
  supabase: DB,
  input: {
    clinicId: string
    patientId: string
    professionalId: string
    medicalRecordId: string | null
    notes: string | null
    items: PrescriptionItemInput[]
  }
) {
  const { data: prescription, error } = await supabase
    .from("prescriptions")
    .insert({
      clinic_id: input.clinicId,
      patient_id: input.patientId,
      professional_id: input.professionalId,
      medical_record_id: input.medicalRecordId,
      notes: input.notes,
    })
    .select("id")
    .single()
  if (error) throw error

  const { error: itemsError } = await supabase.from("prescription_items").insert(
    input.items.map((item, index) => ({
      ...item,
      prescription_id: prescription.id,
      order_index: index,
    }))
  )
  if (itemsError) throw itemsError

  return prescription.id
}

export async function listPrescriptionsForPatient(supabase: DB, clinicId: string, patientId: string) {
  const { data, error } = await supabase
    .from("prescriptions")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .order("issued_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function listPrescriptionItems(supabase: DB, prescriptionIds: string[]) {
  if (prescriptionIds.length === 0) return []
  const { data, error } = await supabase
    .from("prescription_items")
    .select("*")
    .in("prescription_id", prescriptionIds)
    .order("order_index")
  if (error) throw error
  return data ?? []
}
