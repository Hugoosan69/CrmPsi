import { hasPermission, requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { parsePagination } from "@/config/pagination"
import {
  countTransactions,
  listPaymentMethods,
  listTransactions,
} from "@/services/financial.service"
import type { FinancialTransactionStatus, FinancialTransactionType } from "@/types/supabase"
import { PageHeader } from "@/components/shared/page-header"
import { PaginationBar } from "@/components/shared/pagination-bar"
import { FinancialTabs, type FinancialTab } from "@/features/financial/components/financial-tabs"
import { TransactionsTable } from "@/features/financial/components/transactions-table"
import { CreateTransactionDialog } from "@/features/financial/components/create-transaction-dialog"

/** Status que compõem "contas pendentes": o que ainda vai entrar ou sair do caixa. */
const PENDENTES: FinancialTransactionStatus[] = ["pendente", "atrasado"]

const ABAS: FinancialTab[] = ["pendentes", "receitas", "despesas"]

/** O filtro de cada aba, traduzido para a consulta. */
function filtroDaAba(aba: FinancialTab): {
  type?: FinancialTransactionType
  statuses?: FinancialTransactionStatus[]
} {
  if (aba === "receitas") return { type: "receita" }
  if (aba === "despesas") return { type: "despesa" }
  return { statuses: PENDENTES }
}

export default async function GestaoFinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; pagina?: string; por?: string }>
}) {
  const membership = await requirePermission(PERMISSIONS.FINANCIAL_VIEW)
  const canManage = hasPermission(membership, PERMISSIONS.FINANCIAL_MANAGE)

  const { aba, pagina, por } = await searchParams
  const abaAtiva: FinancialTab = ABAS.includes(aba as FinancialTab)
    ? (aba as FinancialTab)
    : "pendentes"
  const { page, pageSize, offset, rangeEnd } = parsePagination({ page: pagina, pageSize: por })

  const supabase = await createClient()
  const [{ rows, total }, paymentMethods, pendentesCount] = await Promise.all([
    listTransactions(supabase, membership.clinicId, {
      ...filtroDaAba(abaAtiva),
      offset,
      rangeEnd,
    }),
    listPaymentMethods(supabase, membership.clinicId),
    // Contagem à parte: o número na aba tem de ser o total de pendentes, não o tamanho da
    // página aberta.
    countTransactions(supabase, membership.clinicId, { statuses: PENDENTES }),
  ])

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Financeiro"
        description="Receitas, despesas e recebimentos da clínica."
        actions={canManage && <CreateTransactionDialog />}
      />

      <div className="grid gap-4">
        <FinancialTabs active={abaAtiva} pendentesCount={pendentesCount} />
        <div className="grid gap-3">
          <TransactionsTable
            transactions={rows}
            paymentMethods={paymentMethods}
            canManage={canManage}
          />
          <PaginationBar total={total} page={page} pageSize={pageSize} label="lançamentos" />
        </div>
      </div>
    </div>
  )
}
