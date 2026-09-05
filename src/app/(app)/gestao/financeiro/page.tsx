import { hasPermission, requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { parsePagination } from "@/config/pagination"
import {
  countTransactions,
  getFinancialSummary,
  listPaymentMethods,
  listTransactions,
} from "@/services/financial.service"
import { listProfessionals } from "@/services/professionals.service"
import type { FinancialTransactionStatus, FinancialTransactionType } from "@/types/supabase"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { PaginationBar } from "@/components/shared/pagination-bar"
import { FinancialTabs, type FinancialTab } from "@/features/financial/components/financial-tabs"
import { TransactionsTable } from "@/features/financial/components/transactions-table"
import { CreateTransactionDialog } from "@/features/financial/components/create-transaction-dialog"
import { FinancialFilters } from "@/features/financial/components/financial-filters"
import { FinancialSummaryCards } from "@/features/financial/components/financial-summary-cards"

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
  searchParams: Promise<{
    aba?: string
    pagina?: string
    por?: string
    de?: string
    ate?: string
    profissional?: string
    origem?: string
    formaPagamento?: string
  }>
}) {
  const membership = await requirePermission(PERMISSIONS.FINANCIAL_VIEW)
  const canManage = hasPermission(membership, PERMISSIONS.FINANCIAL_MANAGE)
  const canEditAmount = hasPermission(membership, PERMISSIONS.FINANCIAL_EDIT_AMOUNT)

  const { aba, pagina, por, de, ate, profissional, origem, formaPagamento } = await searchParams
  const abaAtiva: FinancialTab = ABAS.includes(aba as FinancialTab)
    ? (aba as FinancialTab)
    : "pendentes"
  const { page, pageSize, offset, rangeEnd } = parsePagination({ page: pagina, pageSize: por })

  function parseSourceType(value?: string): "avulsa" | "pacote" | undefined {
    return value === "avulsa" || value === "pacote" ? value : undefined
  }

  const filtrosGerenciais = {
    dateFrom: de || undefined,
    dateTo: ate || undefined,
    professionalId: profissional || undefined,
    sourceType: parseSourceType(origem),
    paymentMethodId: formaPagamento || undefined,
  }

  const supabase = await createClient()
  const [{ rows, total }, paymentMethods, professionals, pendentesCount, summary] = await Promise.all([
    listTransactions(supabase, membership.clinicId, {
      ...filtroDaAba(abaAtiva),
      ...filtrosGerenciais,
      offset,
      rangeEnd,
    }),
    listPaymentMethods(supabase, membership.clinicId),
    listProfessionals(supabase, membership.clinicId),
    // Contagem à parte: o número na aba tem de ser o total de pendentes, não o tamanho da
    // página aberta.
    countTransactions(supabase, membership.clinicId, { statuses: PENDENTES }),
    getFinancialSummary(supabase, membership.clinicId, {
      dateFrom: filtrosGerenciais.dateFrom,
      dateTo: filtrosGerenciais.dateTo,
    }),
  ])

  const exportParams = new URLSearchParams()
  if (de) exportParams.set("de", de)
  if (ate) exportParams.set("ate", ate)
  if (profissional) exportParams.set("profissional", profissional)
  if (origem) exportParams.set("origem", origem)
  if (formaPagamento) exportParams.set("formaPagamento", formaPagamento)
  if (filtroDaAba(abaAtiva).type) exportParams.set("tipo", filtroDaAba(abaAtiva).type!)

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Financeiro"
        description="Receitas, despesas e recebimentos da clínica."
        actions={
          <div className="flex gap-2">
            {/* nativeButton={false}: o Base UI avisa (com razão) quando um "botão" renderiza
                outro elemento — aqui é um link de download de verdade, não um botão. */}
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={`/api/financial/export?${exportParams.toString()}`} />}
            >
              Exportar CSV
            </Button>
            {canManage && <CreateTransactionDialog />}
          </div>
        }
      />

      <FinancialSummaryCards summary={summary} />

      <div className="grid gap-4">
        <FinancialTabs active={abaAtiva} pendentesCount={pendentesCount} />
        <FinancialFilters
          values={{ de, ate, profissional, origem, formaPagamento }}
          professionals={professionals ?? []}
          paymentMethods={paymentMethods}
        />
        <div className="grid gap-3">
          <TransactionsTable
            transactions={rows}
            paymentMethods={paymentMethods}
            canManage={canManage}
            canEditAmount={canEditAmount}
          />
          <PaginationBar total={total} page={page} pageSize={pageSize} label="lançamentos" />
        </div>
      </div>
    </div>
  )
}
