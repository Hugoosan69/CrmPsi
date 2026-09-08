"use server"

import { revalidatePath } from "next/cache"

import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { describeDbError } from "@/lib/db-errors"
import { recordAudit } from "@/services/audit.service"
import { insurerSchema, parseProcedureIds } from "@/schemas/billing.schema"
import {
  createInsurer,
  getInsurer,
  setInsurerActive,
  updateInsurer,
} from "@/services/billing.service"

export type BillingActionState = { error?: string; success?: boolean }

export async function createInsurerAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const membership = await requirePermission(PERMISSIONS.BILLING_MANAGE)

  const parsed = insurerSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const procedureIds = parseProcedureIds(formData.getAll("procedure_ids"))

  const supabase = await createClient()
  try {
    const id = await createInsurer(supabase, membership.clinicId, parsed.data, procedureIds)
    await recordAudit({
      clinicId: membership.clinicId,
      userId: membership.userId,
      action: "billing.insurer.create",
      entityType: "insurer",
      entityId: id,
      after: { ...parsed.data, procedureIds },
    })
    revalidatePath("/gestao/pacotes")
    return { success: true }
  } catch (err) {
    return { error: describeDbError(err) }
  }
}

export async function updateInsurerAction(
  id: string,
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const membership = await requirePermission(PERMISSIONS.BILLING_MANAGE)

  const parsed = insurerSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const procedureIds = parseProcedureIds(formData.getAll("procedure_ids"))

  const supabase = await createClient()
  try {
    const antes = await getInsurer(supabase, membership.clinicId, id)
    await updateInsurer(supabase, membership.clinicId, id, parsed.data, procedureIds)
    await recordAudit({
      clinicId: membership.clinicId,
      userId: membership.userId,
      action: "billing.insurer.update",
      entityType: "insurer",
      entityId: id,
      // O limite mensal decide quem passa a pagar do próprio bolso: a trilha precisa dizer
      // de quanto para quanto, e quem mudou.
      before: antes
        ? { max_guides_per_patient_month: antes.max_guides_per_patient_month }
        : null,
      after: { ...parsed.data, procedureIds },
    })
    revalidatePath("/gestao/pacotes")
    return { success: true }
  } catch (err) {
    return { error: describeDbError(err) }
  }
}

export async function setInsurerActiveAction(id: string, active: boolean): Promise<void> {
  const membership = await requirePermission(PERMISSIONS.BILLING_MANAGE)
  const supabase = await createClient()

  await setInsurerActive(supabase, membership.clinicId, id, active)
  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: active ? "billing.insurer.activate" : "billing.insurer.deactivate",
    entityType: "insurer",
    entityId: id,
  })
  revalidatePath("/gestao/pacotes")
}
