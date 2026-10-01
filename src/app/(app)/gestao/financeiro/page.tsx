import { hasPermission, requireAreaAccess } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { parsePagination } from "@/config/pagination"
import {
  countTransactions,
  getCashFlowSummary,
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
import {
  CashFlowTable,
  ResumoSelector,
  type ResumoType,
} from "@/features/financial/components/financial-cash-flow"

/** Status que compõem "contas pendentes": o que ainda vai entrar ou sair do caixa. */
const PENDENTES: FinancialTransactionStatus[] = ["pendente", "atrasado"]

const ABAS: FinancialTab[] = ["pendentes", "receitas", "despesas"]

const RESUMOS: ResumoType[] = ["periodo", "diario", "mensal"]

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
    especialidade?: string
    origem?: string
    formaPagamento?: string
    resumo?: string
  }>
}) {
  const membership = await requireAreaAccess(PERMISSIONS.MANAGEMENT_ACCESS, PERMISSIONS.FINANCIAL_VIEW)
  const canManage = hasPermission(membership, PERMISSIONS.FINANCIAL_MANAGE)
  const canEditAmount = hasPermission(membership, PERMISSIONS.FINANCIAL_EDIT_AMOUNT)
  const canEditPaid = hasPermission(membership, PERMISSIONS.FINANCIAL_EDIT_PAID)

  const { aba, pagina, por, de, ate, profissional, especialidade, origem, formaPagamento, resumo } = await searchParams
  const abaAtiva: FinancialTab = ABAS.includes(aba as FinancialTab)
    ? (aba as FinancialTab)
    : "pendentes"
  const resumoAtivo: ResumoType = RESUMOS.includes(resumo as ResumoType)
    ? (resumo as ResumoType)
    : "periodo"
  const { page, pageSize, offset, rangeEnd } = parsePagination({ page: pagina, pageSize: por })

  function parseSourceType(value?: string): "avulsa" | "pacote" | undefined {
    return value === "avulsa" || value === "pacote" ? value : undefined
  }

  const filtrosGerenciais = {
    dateFrom: de || undefined,
    dateTo: ate || undefined,
    professionalId: profissional || undefined,
    specialtyId: especialidade || undefined,
    sourceType: parseSourceType(origem),
    paymentMethodId: formaPagamento || undefined,
  }

  const supabase = await createClient()
  const dateFiltros = { dateFrom: filtrosGerenciais.dateFrom, dateTo: filtrosGerenciais.dateTo }

  const [{ rows, total }, paymentMethods, professionals, specialties, pendentesCount, summary, cashFlow] = await Promise.all([
    listTransactions(supabase, membership.clinicId, {
      ...filtroDaAba(abaAtiva),
      ...filtrosGerenciais,
      offset,
      rangeEnd,
    }),
    listPaymentMethods(supabase, membership.clinicId),
    listProfessionals(supabase, membership.clinicId),
    supabase.from("specialties").select("id, name").eq("clinic_id", membership.clinicId).order("name"),
    countTransactions(supabase, membership.clinicId, { statuses: PENDENTES }),
    resumoAtivo === "periodo"
      ? getFinancialSummary(supabase, membership.clinicId, dateFiltros)
      : Promise.resolve(null),
    resumoAtivo !== "periodo"
      ? getCashFlowSummary(
          supabase,
          membership.clinicId,
          resumoAtivo === "diario" ? "day" : "month",
          dateFiltros
        )
      : Promise.resolve(null),
  ])

  const exportTransactionParams = new URLSearchParams()
  if (de) exportTransactionParams.set("de", de)
  if (ate) exportTransactionParams.set("ate", ate)
  if (profissional) exportTransactionParams.set("profissional", profissional)
  if (origem) exportTransactionParams.set("origem", origem)
  if (formaPagamento) exportTransactionParams.set("formaPagamento", formaPagamento)
  if (filtroDaAba(abaAtiva).type) exportTransactionParams.set("tipo", filtroDaAba(abaAtiva).type!)

  const exportSummaryParams = new URLSearchParams()
  if (de) exportSummaryParams.set("de", de)
  if (ate) exportSummaryParams.set("ate", ate)
  if (resumoAtivo !== "periodo") exportSummaryParams.set("agrupamento", resumoAtivo)

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Financeiro"
        description="Receitas, despesas e recebimentos da clínica."
        actions={
          <div className="flex gap-2">
            {resumoAtivo !== "periodo" && (
              <Button
                variant="outline"
                nativeButton={false}
                render={<a href={`/api/financial/export-summary?${exportSummaryParams.toString()}`} />}
              >
                Exportar resumo CSV
              </Button>
            )}
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={`/api/financial/export?${exportTransactionParams.toString()}`} />}
            >
              Exportar lançamentos CSV
            </Button>
            {canManage && <CreateTransactionDialog />}
          </div>
        }
      />

      <div className="flex items-center justify-between">
        <ResumoSelector value={resumoAtivo} />
      </div>

      {resumoAtivo === "periodo" && summary && (
        <FinancialSummaryCards summary={summary} />
      )}
      {resumoAtivo !== "periodo" && cashFlow && (
        <CashFlowTable
          rows={cashFlow}
          groupBy={resumoAtivo === "diario" ? "day" : "month"}
        />
      )}

      <div className="grid gap-4">
        <FinancialTabs active={abaAtiva} pendentesCount={pendentesCount} />
        <FinancialFilters
          values={{ de, ate, profissional, especialidade, origem, formaPagamento }}
          professionals={professionals ?? []}
          specialties={specialties.data ?? []}
          paymentMethods={paymentMethods}
        />
        <div className="grid gap-3">
          <TransactionsTable
            transactions={rows}
            paymentMethods={paymentMethods}
            canManage={canManage}
            canEditAmount={canEditAmount}
            canEditPaid={canEditPaid}
          />
          <PaginationBar total={total} page={page} pageSize={pageSize} label="lançamentos" />
        </div>
      </div>
    </div>
  )
}
