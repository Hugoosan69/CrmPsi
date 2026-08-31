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
    // Histórico de um paciente só, inteiro: é o que a ficha promete mostrar, e o volume é
    // naturalmente limitado pelo número de atendimentos de uma pessoa.
    listTransactions(supabase, clinicId, { patientId }),
    listPaymentMethods(supabase, clinicId),
  ])

  return (
    <TransactionsTable
      transactions={transactions.rows}
      paymentMethods={paymentMethods}
      canManage={canManage}
    />
  )
}
