import { createClient } from "@/lib/supabase/server"
import { listPaymentMethods, listTransactions } from "@/services/financial.service"
import { TransactionsTable } from "./transactions-table"

export async function PatientFinancialSummary({
  clinicId,
  patientId,
  canManage,
}: {
  clinicId: string
  patientId: string
  canManage: boolean
}) {
  const supabase = await createClient()
  const [transactions, paymentMethods] = await Promise.all([
    listTransactions(supabase, clinicId, { patientId }),
    listPaymentMethods(supabase, clinicId),
  ])

  return <TransactionsTable transactions={transactions} paymentMethods={paymentMethods} canManage={canManage} />
}
