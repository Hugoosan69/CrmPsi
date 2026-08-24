"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import { prescriptionSchema } from "@/schemas/prescription.schema"
import { createPrescription } from "@/services/prescriptions.service"
import { recordAudit } from "@/services/audit.service"

export type PrescriptionActionState = { error?: string; success?: boolean; prescriptionId?: string }

export async function createPrescriptionAction(
  context: { patientId: string; professionalId: string; medicalRecordId: string | null; queueEntryId?: string },
  _prev: PrescriptionActionState,
  formData: FormData
): Promise<PrescriptionActionState> {
  const membership = await requirePermission(PERMISSIONS.DOCUMENTS_ISSUE)

  const itemsRaw = formData.get("items_json")
  let items: unknown
  try {
    items = JSON.parse(typeof itemsRaw === "string" ? itemsRaw : "[]")
  } catch {
    return { error: "Itens da prescrição inválidos" }
  }

  const parsed = prescriptionSchema.safeParse({ notes: formData.get("notes"), items })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createClient()
  const prescriptionId = await createPrescription(supabase, {
    clinicId: membership.clinicId,
    patientId: context.patientId,
    professionalId: context.professionalId,
    medicalRecordId: context.medicalRecordId,
    notes: parsed.data.notes || null,
    items: parsed.data.items,
  })

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "prescription.issue",
    entityType: "prescription",
    entityId: prescriptionId,
    after: parsed.data,
  })

  if (context.queueEntryId) revalidatePath(`/profissional/atendimento/${context.queueEntryId}`)
  revalidatePath(`/profissional/pacientes/${context.patientId}`)
  revalidatePath(`/recepcao/pacientes/${context.patientId}`)
  return { success: true, prescriptionId }
}
