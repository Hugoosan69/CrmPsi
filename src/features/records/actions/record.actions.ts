"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import { medicalRecordSchema } from "@/schemas/record.schema"
import { addDiagnosis, removeDiagnosis, searchCidCodes, updateMedicalRecord } from "@/services/records.service"
import { recordAudit } from "@/services/audit.service"

export type RecordActionState = { error?: string; success?: boolean }

function revalidateAtendimento(queueEntryId: string, patientId: string) {
  revalidatePath(`/profissional/atendimento/${queueEntryId}`)
  revalidatePath(`/profissional/pacientes/${patientId}`)
  revalidatePath(`/recepcao/pacientes/${patientId}`)
}

export async function updateMedicalRecordAction(
  medicalRecordId: string,
  queueEntryId: string,
  patientId: string,
  _prev: RecordActionState,
  formData: FormData
): Promise<RecordActionState> {
  const membership = await requirePermission(PERMISSIONS.SERVICE_MANAGE)

  const parsed = medicalRecordSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createClient()
  await updateMedicalRecord(supabase, membership.clinicId, medicalRecordId, parsed.data)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "medical_record.update",
    entityType: "medical_record",
    entityId: medicalRecordId,
    after: parsed.data,
  })

  revalidateAtendimento(queueEntryId, patientId)
  return { success: true }
}

export async function searchCidAction(query: string) {
  await requirePermission(PERMISSIONS.SERVICE_MANAGE)
  const supabase = await createClient()
  return searchCidCodes(supabase, query)
}

export async function addDiagnosisAction(
  medicalRecordId: string,
  queueEntryId: string,
  patientId: string,
  cidCode: string,
  isPrimary: boolean
) {
  const membership = await requirePermission(PERMISSIONS.SERVICE_MANAGE)
  const supabase = await createClient()
  await addDiagnosis(supabase, { medicalRecordId, cidCode, isPrimary })

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "medical_record.add_diagnosis",
    entityType: "medical_record",
    entityId: medicalRecordId,
    after: { cidCode },
  })

  revalidateAtendimento(queueEntryId, patientId)
}

export async function removeDiagnosisAction(
  diagnosisId: string,
  medicalRecordId: string,
  queueEntryId: string,
  patientId: string
) {
  const membership = await requirePermission(PERMISSIONS.SERVICE_MANAGE)
  const supabase = await createClient()
  await removeDiagnosis(supabase, diagnosisId)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "medical_record.remove_diagnosis",
    entityType: "medical_record",
    entityId: medicalRecordId,
  })

  revalidateAtendimento(queueEntryId, patientId)
}
