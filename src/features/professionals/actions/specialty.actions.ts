"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import { specialtySchema } from "@/schemas/specialty.schema"
import {
  createSpecialty,
  setSpecialtyActive,
  updateSpecialty,
} from "@/services/professionals.service"
import { recordAudit } from "@/services/audit.service"
import { describeDbError } from "@/lib/db-errors"

export type SpecialtyActionState = { error?: string; success?: boolean }

/**
 * Permissão: settings.manage — o catálogo da clínica (procedimentos, salas, especialidades)
 * é configuração, não operação do dia a dia. A RLS de `specialties` é apenas
 * `has_clinic_access`, ou seja, qualquer membro poderia escrever direto na tabela; a
 * checagem real de quem pode mexer no catálogo vive aqui.
 */
export async function createSpecialtyAction(
  _prev: SpecialtyActionState,
  formData: FormData
): Promise<SpecialtyActionState> {
  const membership = await requirePermission(PERMISSIONS.CATALOG_MANAGE)

  const parsed = specialtySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  try {
    const supabase = await createClient()
    const id = await createSpecialty(supabase, membership.clinicId, parsed.data)

    await recordAudit({
      clinicId: membership.clinicId,
      userId: membership.userId,
      action: "specialty.create",
      entityType: "specialty",
      entityId: id,
      after: parsed.data,
    })
  } catch (err) {
    console.error("createSpecialtyAction failed", err)
    // describeDbError traduz o 23505 do índice único de migrations/006 (nome repetido
    // na mesma clínica) e tem fallback próprio para o resto.
    return { error: describeDbError(err) }
  }

  revalidatePath("/gestao/profissionais")
  return { success: true }
}

export async function updateSpecialtyAction(
  specialtyId: string,
  _prev: SpecialtyActionState,
  formData: FormData
): Promise<SpecialtyActionState> {
  const membership = await requirePermission(PERMISSIONS.CATALOG_MANAGE)

  const parsed = specialtySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  try {
    const supabase = await createClient()
    await updateSpecialty(supabase, membership.clinicId, specialtyId, parsed.data)

    await recordAudit({
      clinicId: membership.clinicId,
      userId: membership.userId,
      action: "specialty.update",
      entityType: "specialty",
      entityId: specialtyId,
      after: parsed.data,
    })
  } catch (err) {
    console.error("updateSpecialtyAction failed", err)
    return { error: describeDbError(err) }
  }

  revalidatePath("/gestao/profissionais")
  return { success: true }
}

export async function setSpecialtyActiveAction(specialtyId: string, active: boolean) {
  const membership = await requirePermission(PERMISSIONS.CATALOG_MANAGE)
  const supabase = await createClient()

  await setSpecialtyActive(supabase, membership.clinicId, specialtyId, active)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: active ? "specialty.activate" : "specialty.deactivate",
    entityType: "specialty",
    entityId: specialtyId,
    after: { active },
  })

  revalidatePath("/gestao/profissionais")
}
