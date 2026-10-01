"use server"

import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { listTransactions, type TransactionView } from "@/services/financial.service"
import { describeDbError } from "@/lib/db-errors"

export async function listTransactionsForPeriodAction(
  dateFrom: string,
  dateTo: string
): Promise<{ rows?: TransactionView[]; error?: string }> {
  const membership = await requirePermission(PERMISSIONS.FINANCIAL_VIEW)
  const supabase = await createClient()

  try {
    const { rows } = await listTransactions(supabase, membership.clinicId, {
      dateFrom,
      dateTo,
      status: "pago",
      rangeEnd: 499,
    })
    return { rows }
  } catch (err) {
    return { error: describeDbError(err) }
  }
}
