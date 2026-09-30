"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import {
  linkProfessionalToPatient,
  unlinkProfessionalFromPatient,
} from "@/services/professional-links.service"
import { recordAudit } from "@/services/audit.service"

export type LinkActionState = { error?: string; success?: boolean }

/**
 * Vincular um profissional a um paciente manualmente.
 * Permissão: `patients.manage` — é a recepção ou gestão quem faz.
 */
export async function linkProfessionalAction(
  patientId: string,
  professionalId: string
): Promise<LinkActionState> {
  const membership = await requirePermission(PERMISSIONS.PATIENTS_MANAGE)
  const supabase = await createClient()

  try {
    await linkProfessionalToPatient(
      supabase,
      membership.clinicId,
      professionalId,
      patientId
    )
  } catch {
    return { error: "Não foi possível vincular o profissional." }
  }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "professional_link.create",
    entityType: "patient",
    entityId: patientId,
    after: { professionalId, source: "manual" },
  })

  revalidatePath(`/recepcao/pacientes/${patientId}`)
  revalidatePath(`/profissional/pacientes`)
  return { success: true }
}

/**
 * Desvincular um profissional de um paciente.
 * Permissão: `patients.manage` — só recepção/gestão.
 */
export async function unlinkProfessionalAction(
  patientId: string,
  professionalId: string
): Promise<LinkActionState> {
  const membership = await requirePermission(PERMISSIONS.PATIENTS_MANAGE)
  const supabase = await createClient()

  try {
    await unlinkProfessionalFromPatient(supabase, professionalId, patientId)
  } catch {
    return { error: "Não foi possível desvincular o profissional." }
  }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "professional_link.delete",
    entityType: "patient",
    entityId: patientId,
    before: { professionalId },
  })

  revalidatePath(`/recepcao/pacientes/${patientId}`)
  revalidatePath(`/profissional/pacientes`)
  return { success: true }
}
