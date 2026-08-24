import { hasPermission, requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { listPaymentMethods, listTransactions } from "@/services/financial.service"
import { PageHeader } from "@/components/shared/page-header"
import { FinancialTabs } from "@/features/financial/components/financial-tabs"
import { CreateTransactionDialog } from "@/features/financial/components/create-transaction-dialog"

export default async function GestaoFinanceiroPage() {
  const membership = await requirePermission(PERMISSIONS.FINANCIAL_VIEW)
  const canManage = hasPermission(membership, PERMISSIONS.FINANCIAL_MANAGE)

  const supabase = await createClient()
  const [transactions, paymentMethods] = await Promise.all([
    listTransactions(supabase, membership.clinicId),
    listPaymentMethods(supabase, membership.clinicId),
  ])

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Financeiro"
        description="Receitas, despesas e recebimentos da clínica."
        actions={canManage && <CreateTransactionDialog />}
      />
      <FinancialTabs transactions={transactions} paymentMethods={paymentMethods} canManage={canManage} />
    </div>
  )
}
