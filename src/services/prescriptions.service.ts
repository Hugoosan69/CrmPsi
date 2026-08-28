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

export type PrintablePrescription = {
  id: string
  issued_at: string
  notes: string | null
  patient: { full_name: string; social_name: string | null; cpf: string | null }
  professional: { full_name: string; professional_register: string | null; specialty: string | null }
  items: {
    medication_name: string
    concentration: string | null
    pharmaceutical_form: string | null
    dose: string | null
    frequency: string | null
    duration: string | null
    quantity: string | null
    instructions: string | null
  }[]
}

/** Receita completa para impressão. Filtrada por clinic_id além do id — a RLS prova apenas
 *  que o chamador pertence a alguma clínica, não que a receita seja desta. */
export async function getPrintablePrescription(
  supabase: DB,
  clinicId: string,
  prescriptionId: string
): Promise<PrintablePrescription | null> {
  const { data, error } = await supabase
    .from("prescriptions")
    .select(
      `id, issued_at, notes,
       patients(full_name, social_name, cpf),
       professionals(full_name, professional_register, specialties(name)),
       prescription_items(medication_name, concentration, pharmaceutical_form, dose,
                          frequency, duration, quantity, instructions, order_index)`
    )
    .eq("id", prescriptionId)
    .eq("clinic_id", clinicId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const pro = data.professionals as unknown as {
    full_name: string
    professional_register: string | null
    specialties: { name: string } | null
  }
  const rawItems = (data.prescription_items ?? []) as unknown as (PrintablePrescription["items"][number] & {
    order_index: number
  })[]

  return {
    id: data.id,
    issued_at: data.issued_at,
    notes: data.notes,
    patient: data.patients as unknown as PrintablePrescription["patient"],
    professional: {
      full_name: pro?.full_name ?? "",
      professional_register: pro?.professional_register ?? null,
      specialty: pro?.specialties?.name ?? null,
    },
    // Ordenado aqui porque a ordem é a da prescrição, e o Postgres não garante a ordem de
    // linhas de uma relação aninhada sem order by explícito.
    items: [...rawItems].sort((a, b) => a.order_index - b.order_index),
  }
}
