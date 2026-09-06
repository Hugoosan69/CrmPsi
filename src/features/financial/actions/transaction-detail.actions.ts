"use server"

import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { getTransactionDetail, type TransactionDetail } from "@/services/financial-detail.service"
import { describeDbError } from "@/lib/db-errors"

/**
 * Carregado sob demanda, ao abrir o modal — e não junto da lista: é uma leitura de várias
 * tabelas que só interessa para a linha que a pessoa clicou. Trazer isso para as 25 linhas
 * da página multiplicaria o custo por nada.
 */
export async function getTransactionDetailAction(
  transactionId: string
): Promise<{ detail?: TransactionDetail; error?: string }> {
  const membership = await requirePermission(PERMISSIONS.FINANCIAL_VIEW)
  const supabase = await createClient()

  try {
    const detail = await getTransactionDetail(supabase, membership.clinicId, transactionId)
    if (!detail) return { error: "Lançamento não encontrado." }
    return { detail }
  } catch (err) {
    return { error: describeDbError(err) }
  }
}
