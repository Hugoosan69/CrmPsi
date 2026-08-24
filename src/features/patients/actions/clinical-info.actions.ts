"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import { patientClinicalInfoSchema } from "@/schemas/patient-clinical-info.schema"
import { upsertPatientClinicalInfo } from "@/services/patients.service"
import { recordAudit } from "@/services/audit.service"

export type ClinicalInfoActionState = { error?: string; success?: boolean }

export async function updateClinicalInfoAction(
  patientId: string,
  _prev: ClinicalInfoActionState,
  formData: FormData
): Promise<ClinicalInfoActionState> {
  // Clinical info is edited by whoever conducts the atendimento, not by reception.
  const membership = await requirePermission(PERMISSIONS.SERVICE_MANAGE)

  const parsed = patientClinicalInfoSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createClient()
  await upsertPatientClinicalInfo(supabase, patientId, parsed.data)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "patient.clinical_info.update",
    entityType: "patient",
    entityId: patientId,
    after: parsed.data,
  })

  revalidatePath(`/profissional/pacientes/${patientId}`)
  revalidatePath(`/recepcao/pacientes/${patientId}`)
  return { success: true }
}
