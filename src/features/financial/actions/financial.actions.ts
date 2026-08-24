"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import { transactionSchema, paymentSchema } from "@/schemas/financial.schema"
import {
  cancelTransaction,
  createTransaction,
  getTransaction,
  registerPayment,
} from "@/services/financial.service"
import { markQueueEntriesReleasedForTransaction } from "@/services/queue.service"
import { recordAudit } from "@/services/audit.service"

export type FinancialActionState = { error?: string; success?: boolean }

function revalidateFinancial() {
  revalidatePath("/gestao/financeiro")
  revalidatePath("/recepcao/financeiro")
}

export async function createTransactionAction(
  _prev: FinancialActionState,
  formData: FormData
): Promise<FinancialActionState> {
  const membership = await requirePermission(PERMISSIONS.FINANCIAL_MANAGE)

  const parsed = transactionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createClient()
  const transactionId = await createTransaction(supabase, membership.clinicId, membership.userId, parsed.data)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: parsed.data.type === "receita" ? "financial.create_receita" : "financial.create_despesa",
    entityType: "financial_transaction",
    entityId: transactionId,
    after: parsed.data,
  })

  revalidateFinancial()
  return { success: true }
}

export async function registerPaymentAction(
  transactionId: string,
  _prev: FinancialActionState,
  formData: FormData
): Promise<FinancialActionState> {
  const membership = await requirePermission(PERMISSIONS.FINANCIAL_MANAGE)

  const parsed = paymentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createClient()
  await registerPayment(supabase, membership.clinicId, {
    transactionId,
    paymentMethodId: parsed.data.payment_method_id,
    amount: parsed.data.amount,
    receivedBy: membership.userId,
    notes: parsed.data.notes,
  })

  // CSIB rule: settling the charge is what unblocks the queue. If this charge was
  // gating a checked-in patient and it is now fully paid, move them from
  // `payment_pending` to `released` so reception can send them to the queue.
  const charge = await getTransaction(supabase, membership.clinicId, transactionId)
  if (charge.status === "pago") {
    await markQueueEntriesReleasedForTransaction(supabase, membership.clinicId, transactionId)
    revalidatePath("/recepcao/fila")
  }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "financial.register_payment",
    entityType: "financial_transaction",
    entityId: transactionId,
    after: { ...parsed.data, chargeStatus: charge.status },
  })

  revalidateFinancial()
  return { success: true }
}

export async function cancelTransactionAction(transactionId: string) {
  const membership = await requirePermission(PERMISSIONS.FINANCIAL_MANAGE)

  const supabase = await createClient()
  await cancelTransaction(supabase, membership.clinicId, transactionId)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "financial.cancel",
    entityType: "financial_transaction",
    entityId: transactionId,
  })

  revalidateFinancial()
}
