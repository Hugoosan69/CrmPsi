"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { hasPermission, requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import { transactionSchema, paymentSchema } from "@/schemas/financial.schema"
import {
  cancelTransaction,
  createTransaction,
  getTransaction,
  registerPayment,
  updateTransactionAmount,
} from "@/services/financial.service"
import { markQueueEntriesReleasedForTransaction } from "@/services/queue.service"
import { recordAudit } from "@/services/audit.service"

export type FinancialActionState = { error?: string; success?: boolean }

function revalidateFinancial() {
  revalidatePath("/gestao/financeiro")
  revalidatePath("/recepcao/financeiro")
}

/**
 * Corrige o valor de um lançamento já registrado.
 *
 * Permissão própria (`financial.edit_amount`, migrations/019): registrar um recebimento é
 * uma coisa, reescrever um valor já contabilizado é outra. O audit_log guarda o valor
 * anterior e o novo — a tela avisa quem edita que isso fica registrado, e este é o
 * registro.
 *
 * Quando o lançamento já está **pago**, exige também `financial.edit_paid`
 * (migrations/020): aí não se está corrigindo uma cobrança em aberto, e sim mudando um
 * valor que já entrou no caixa e já contou no fechamento. A checagem é aqui, e não só na
 * tela — a UI esconder o botão nunca é a garantia.
 */
export async function updateTransactionAmountAction(
  transactionId: string,
  _prev: FinancialActionState,
  formData: FormData
): Promise<FinancialActionState> {
  const membership = await requirePermission(PERMISSIONS.FINANCIAL_EDIT_AMOUNT)

  const raw = formData.get("amount")
  const amount = typeof raw === "string" && raw.trim() ? Number(raw) : NaN
  if (Number.isNaN(amount) || amount < 0) {
    return { error: "Informe um valor válido." }
  }

  const supabase = await createClient()
  const before = await getTransaction(supabase, membership.clinicId, transactionId)

  if (before.status === "pago" && !hasPermission(membership, PERMISSIONS.FINANCIAL_EDIT_PAID)) {
    return {
      error:
        "Este lançamento já está pago. Alterar um registro pago exige a permissão “Alterar um lançamento que já está pago”.",
    }
  }

  await updateTransactionAmount(supabase, membership.clinicId, transactionId, amount)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "financial.edit_amount",
    entityType: "financial_transaction",
    entityId: transactionId,
    before: { amount: before.amount, status: before.status },
    after: { amount, reason: String(formData.get("reason") ?? "") || null },
  })

  revalidateFinancial()
  return { success: true }
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
