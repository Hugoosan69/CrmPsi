import { hasPermission, requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { listPaymentMethods, listTransactions } from "@/services/financial.service"
import { parsePagination } from "@/config/pagination"
import { PageHeader } from "@/components/shared/page-header"
import { PaginationBar } from "@/components/shared/pagination-bar"
import { TransactionsTable } from "@/features/financial/components/transactions-table"
import { CreateTransactionDialog } from "@/features/financial/components/create-transaction-dialog"

export default async function RecepcaoFinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; por?: string }>
}) {
  const membership = await requirePermission(PERMISSIONS.FINANCIAL_VIEW)
  const canManage = hasPermission(membership, PERMISSIONS.FINANCIAL_MANAGE)

  const { pagina, por } = await searchParams
  const { page, pageSize, offset, rangeEnd } = parsePagination({ page: pagina, pageSize: por })

  const supabase = await createClient()
  const [{ rows, total }, paymentMethods] = await Promise.all([
    listTransactions(supabase, membership.clinicId, { type: "receita", offset, rangeEnd }),
    listPaymentMethods(supabase, membership.clinicId),
  ])

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Financeiro"
        description="Cobranças de pacientes e registro de pagamentos."
        actions={canManage && <CreateTransactionDialog defaultType="receita" />}
      />
      <div className="grid gap-3">
        <TransactionsTable
          transactions={rows}
          paymentMethods={paymentMethods}
          canManage={canManage}
        />
        <PaginationBar total={total} page={page} pageSize={pageSize} label="cobranças" />
      </div>
    </div>
  )
}
