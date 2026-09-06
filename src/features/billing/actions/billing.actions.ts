"use server"

import { revalidatePath } from "next/cache"

import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { describeDbError } from "@/lib/db-errors"
import { recordAudit } from "@/services/audit.service"
import { billingTypeSchema } from "@/schemas/billing.schema"
import {
  createBillingType,
  getBillingType,
  setBillingTypeActive,
  updateBillingType,
} from "@/services/billing.service"

export type BillingActionState = { error?: string; success?: boolean }

export async function createBillingTypeAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const membership = await requirePermission(PERMISSIONS.BILLING_MANAGE)

  const parsed = billingTypeSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createClient()
  try {
    const id = await createBillingType(supabase, membership.clinicId, parsed.data)
    await recordAudit({
      clinicId: membership.clinicId,
      userId: membership.userId,
      action: "billing.type.create",
      entityType: "billing_type",
      entityId: id,
      after: parsed.data,
    })
    revalidatePath("/gestao/cobranca")
    return { success: true }
  } catch (err) {
    return { error: describeDbError(err) }
  }
}

export async function updateBillingTypeAction(
  id: string,
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const membership = await requirePermission(PERMISSIONS.BILLING_MANAGE)

  const parsed = billingTypeSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createClient()
  try {
    const antes = await getBillingType(supabase, membership.clinicId, id)
    await updateBillingType(supabase, membership.clinicId, id, parsed.data)
    await recordAudit({
      clinicId: membership.clinicId,
      userId: membership.userId,
      action: "billing.type.update",
      entityType: "billing_type",
      entityId: id,
      // O valor por guia é o que o convênio paga: mudá-lo muda o faturamento do mês, e a
      // trilha precisa dizer de quanto para quanto.
      before: antes ? { amount_per_guide: antes.amount_per_guide, payer: antes.payer } : null,
      after: parsed.data,
    })
    revalidatePath("/gestao/cobranca")
    return { success: true }
  } catch (err) {
    return { error: describeDbError(err) }
  }
}

export async function setBillingTypeActiveAction(id: string, active: boolean): Promise<void> {
  const membership = await requirePermission(PERMISSIONS.BILLING_MANAGE)
  const supabase = await createClient()

  await setBillingTypeActive(supabase, membership.clinicId, id, active)
  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: active ? "billing.type.activate" : "billing.type.deactivate",
    entityType: "billing_type",
    entityId: id,
  })
  revalidatePath("/gestao/cobranca")
}
