"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import { professionalSchema } from "@/schemas/professional.schema"
import {
  createProfessional,
  setProfessionalActive,
  updateProfessional,
} from "@/services/professionals.service"
import { recordAudit } from "@/services/audit.service"

export type ProfessionalActionState = { error?: string; success?: boolean }

export async function createProfessionalAction(
  _prev: ProfessionalActionState,
  formData: FormData
): Promise<ProfessionalActionState> {
  const membership = await requirePermission(PERMISSIONS.PROFESSIONALS_MANAGE)

  const raw = Object.fromEntries(formData)
  const parsed = professionalSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createClient()
  await createProfessional(supabase, membership.clinicId, parsed.data)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "professional.create",
    entityType: "professional",
    after: parsed.data,
  })

  revalidatePath("/gestao/profissionais")
  return { success: true }
}

export async function updateProfessionalAction(
  professionalId: string,
  _prev: ProfessionalActionState,
  formData: FormData
): Promise<ProfessionalActionState> {
  const membership = await requirePermission(PERMISSIONS.PROFESSIONALS_MANAGE)

  const parsed = professionalSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createClient()
  await updateProfessional(supabase, membership.clinicId, professionalId, parsed.data)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "professional.update",
    entityType: "professional",
    entityId: professionalId,
    after: parsed.data,
  })

  revalidatePath("/gestao/profissionais")
  return { success: true }
}

export async function setProfessionalActiveAction(professionalId: string, active: boolean) {
  const membership = await requirePermission(PERMISSIONS.PROFESSIONALS_MANAGE)

  const supabase = await createClient()
  await setProfessionalActive(supabase, membership.clinicId, professionalId, active)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: active ? "professional.activate" : "professional.deactivate",
    entityType: "professional",
    entityId: professionalId,
  })

  revalidatePath("/gestao/profissionais")
}
