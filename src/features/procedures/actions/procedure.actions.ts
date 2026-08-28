"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import { procedureSchema } from "@/schemas/procedure.schema"
import {
  createProcedure,
  setProcedureActive,
  updateProcedure,
} from "@/services/procedures.service"
import { recordAudit } from "@/services/audit.service"

export type ProcedureActionState = { error?: string; success?: boolean }

export async function createProcedureAction(
  _prev: ProcedureActionState,
  formData: FormData
): Promise<ProcedureActionState> {
  const membership = await requirePermission(PERMISSIONS.CATALOG_MANAGE)

  const parsed = procedureSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createClient()
  await createProcedure(supabase, membership.clinicId, parsed.data)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "procedure.create",
    entityType: "procedure",
    after: parsed.data,
  })

  revalidatePath("/gestao/procedimentos")
  return { success: true }
}

export async function updateProcedureAction(
  procedureId: string,
  _prev: ProcedureActionState,
  formData: FormData
): Promise<ProcedureActionState> {
  const membership = await requirePermission(PERMISSIONS.CATALOG_MANAGE)

  const parsed = procedureSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createClient()
  await updateProcedure(supabase, membership.clinicId, procedureId, parsed.data)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "procedure.update",
    entityType: "procedure",
    entityId: procedureId,
    after: parsed.data,
  })

  revalidatePath("/gestao/procedimentos")
  return { success: true }
}

export async function setProcedureActiveAction(procedureId: string, active: boolean) {
  const membership = await requirePermission(PERMISSIONS.CATALOG_MANAGE)

  const supabase = await createClient()
  await setProcedureActive(supabase, membership.clinicId, procedureId, active)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: active ? "procedure.activate" : "procedure.deactivate",
    entityType: "procedure",
    entityId: procedureId,
  })

  revalidatePath("/gestao/procedimentos")
}
