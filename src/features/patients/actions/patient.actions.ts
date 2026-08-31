"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import { patientSchema } from "@/schemas/patient.schema"
import { createPatient, listPatients, setPatientActive, updatePatient } from "@/services/patients.service"
import { recordAudit } from "@/services/audit.service"

export type PatientActionState = { error?: string; patientId?: string }

/** Backs PatientCombobox — used anywhere a person needs to pick an existing patient
 * (agenda, fila) without navigating away from the dialog they're in. */
export async function searchPatientsAction(query: string) {
  const membership = await requirePermission(PERMISSIONS.PATIENTS_VIEW)
  if (!query || query.trim().length < 2) return []

  const supabase = await createClient()
  // Vinte é o teto de um seletor: quem digitou duas letras vai refinar a busca, não rolar
  // uma lista. Explícito aqui em vez de herdado de um limite escondido no serviço.
  const patients = await listPatients(supabase, membership.clinicId, {
    search: query,
    rangeEnd: 19,
  })
  return patients.rows.map((p) => ({
    id: p.id,
    label: p.social_name || p.full_name,
    detail: [p.cpf, p.phone].filter(Boolean).join(" · "),
  }))
}

export async function createPatientAction(
  _prev: PatientActionState,
  formData: FormData
): Promise<PatientActionState> {
  const membership = await requirePermission(PERMISSIONS.PATIENTS_MANAGE)

  const parsed = patientSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createClient()
  const created = await createPatient(supabase, membership.clinicId, membership.userId, parsed.data)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "patient.create",
    entityType: "patient",
    entityId: created.id,
    after: parsed.data,
  })

  revalidatePath("/recepcao/pacientes")
  return { patientId: created.id }
}

export async function updatePatientAction(
  patientId: string,
  _prev: PatientActionState,
  formData: FormData
): Promise<PatientActionState> {
  const membership = await requirePermission(PERMISSIONS.PATIENTS_MANAGE)

  const parsed = patientSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createClient()
  await updatePatient(supabase, membership.clinicId, patientId, parsed.data)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "patient.update",
    entityType: "patient",
    entityId: patientId,
    after: parsed.data,
  })

  revalidatePath("/recepcao/pacientes")
  revalidatePath(`/profissional/pacientes/${patientId}`)
  return { patientId }
}

export async function setPatientActiveAction(patientId: string, active: boolean) {
  const membership = await requirePermission(PERMISSIONS.PATIENTS_MANAGE)

  const supabase = await createClient()
  await setPatientActive(supabase, membership.clinicId, patientId, active)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: active ? "patient.activate" : "patient.deactivate",
    entityType: "patient",
    entityId: patientId,
  })

  revalidatePath("/recepcao/pacientes")
}
