"use server"

import { revalidatePath } from "next/cache"

import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { describeDbError } from "@/lib/db-errors"
import { recordAudit } from "@/services/audit.service"
import { insurerSchema } from "@/schemas/billing.schema"
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

  const supabase = await createClient()
  try {
    const id = await createInsurer(supabase, membership.clinicId, parsed.data)
    await recordAudit({
      clinicId: membership.clinicId,
      userId: membership.userId,
      action: "billing.insurer.create",
      entityType: "insurer",
      entityId: id,
      after: parsed.data,
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

  const supabase = await createClient()
  try {
    const antes = await getInsurer(supabase, membership.clinicId, id)
    await updateInsurer(supabase, membership.clinicId, id, parsed.data)
    await recordAudit({
      clinicId: membership.clinicId,
      userId: membership.userId,
      action: "billing.insurer.update",
      entityType: "insurer",
      entityId: id,
      // O valor por guia muda o faturamento do mês: a trilha precisa dizer de quanto para
      // quanto, e quem mudou.
      before: antes ? { amount_per_guide: antes.amount_per_guide } : null,
      after: parsed.data,
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
