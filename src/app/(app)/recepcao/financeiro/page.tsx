import { hasPermission, requireAreaAccess } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { parsePagination } from "@/config/pagination"
import {
  countTransactions,
  listPaymentMethods,
  listTransactions,
} from "@/services/financial.service"
import { listProfessionals } from "@/services/professionals.service"
import type { FinancialTransactionStatus, FinancialTransactionType } from "@/types/supabase"
import { PageHeader } from "@/components/shared/page-header"
import { PaginationBar } from "@/components/shared/pagination-bar"
import { FinancialTabs, type FinancialTab } from "@/features/financial/components/financial-tabs"
import { TransactionsTable } from "@/features/financial/components/transactions-table"
import { CreateTransactionDialog } from "@/features/financial/components/create-transaction-dialog"
import { FinancialFilters } from "@/features/financial/components/financial-filters"

const PENDENTES: FinancialTransactionStatus[] = ["pendente", "atrasado"]

const ABAS: FinancialTab[] = ["pendentes", "receitas", "despesas"]

function filtroDaAba(aba: FinancialTab): {
  type?: FinancialTransactionType
  statuses?: FinancialTransactionStatus[]
} {
  if (aba === "receitas") return { type: "receita" }
  if (aba === "despesas") return { type: "despesa" }
  return { statuses: PENDENTES }
}

export default async function RecepcaoFinanceiroPage({
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
  }>
}) {
  const membership = await requireAreaAccess(PERMISSIONS.RECEPTION_ACCESS, PERMISSIONS.FINANCIAL_VIEW)
  const canManage = hasPermission(membership, PERMISSIONS.FINANCIAL_MANAGE)
  const canEditAmount = hasPermission(membership, PERMISSIONS.FINANCIAL_EDIT_AMOUNT)
  const canEditPaid = hasPermission(membership, PERMISSIONS.FINANCIAL_EDIT_PAID)

  const { aba, pagina, por, de, ate, profissional, especialidade, origem, formaPagamento } = await searchParams
  const abaAtiva: FinancialTab = ABAS.includes(aba as FinancialTab)
    ? (aba as FinancialTab)
    : "pendentes"
  const { page, pageSize, offset, rangeEnd } = parsePagination({ page: pagina, pageSize: por })

  function parseSourceType(value?: string): "avulsa" | "pacote" | undefined {
    return value === "avulsa" || value === "pacote" ? value : undefined
  }

  const filtros = {
    dateFrom: de || undefined,
    dateTo: ate || undefined,
    professionalId: profissional || undefined,
    specialtyId: especialidade || undefined,
    sourceType: parseSourceType(origem),
    paymentMethodId: formaPagamento || undefined,
  }

  const supabase = await createClient()

  const [{ rows, total }, paymentMethods, professionals, specialties, pendentesCount] = await Promise.all([
    listTransactions(supabase, membership.clinicId, {
      ...filtroDaAba(abaAtiva),
      ...filtros,
      offset,
      rangeEnd,
    }),
    listPaymentMethods(supabase, membership.clinicId),
    listProfessionals(supabase, membership.clinicId),
    supabase.from("specialties").select("id, name").eq("clinic_id", membership.clinicId).order("name"),
    countTransactions(supabase, membership.clinicId, { statuses: PENDENTES }),
  ])

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Financeiro"
        description="Cobranças de pacientes e registro de pagamentos."
        actions={canManage && <CreateTransactionDialog defaultType="receita" />}
      />

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
  )
}
