import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { parsePagination } from "@/config/pagination"
import { getFinancialSummary, listTransactions } from "@/services/financial.service"
import { getProfessionalByUserId } from "@/services/professionals.service"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { PaginationBar } from "@/components/shared/pagination-bar"
import { TransactionsTable } from "@/features/financial/components/transactions-table"
import { FinancialSummaryCards } from "@/features/financial/components/financial-summary-cards"
import { OwnFinancialFilters } from "@/features/financial/components/own-financial-filters"

/**
 * "Meu financeiro" — a movimentação dos atendimentos de quem está logado, e só dela.
 *
 * O recorte não vem de um filtro que a pessoa escolhe: vem do profissional vinculado ao
 * login (`getProfessionalByUserId`), aplicado no servidor em toda consulta desta tela. Um
 * profissional sem cadastro vinculado não vê lançamento nenhum — é o mesmo princípio da
 * fila, onde o vínculo login↔profissional é o que define o que é "seu".
 */
export default async function ProfessionalFinancialPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; por?: string; de?: string; ate?: string }>
}) {
  const membership = await requirePermission(PERMISSIONS.FINANCIAL_VIEW_OWN)
  const supabase = await createClient()

  const professional = await getProfessionalByUserId(supabase, membership.clinicId, membership.userId)

  const { pagina, por, de, ate } = await searchParams
  const { page, pageSize, offset, rangeEnd } = parsePagination({ page: pagina, pageSize: por })

  if (!professional) {
    return (
      <div className="grid gap-6">
        <PageHeader
          title="Meu financeiro"
          description="A movimentação dos seus atendimentos."
        />
        <EmptyState
          title="Seu login não está vinculado a um cadastro de profissional."
          description="Peça à gestão para vincular seu usuário ao seu cadastro na tela de Profissionais — é esse vínculo que define quais atendimentos são seus."
        />
      </div>
    )
  }

  const [{ rows, total }, summary] = await Promise.all([
    listTransactions(supabase, membership.clinicId, {
      professionalId: professional.id,
      dateFrom: de || undefined,
      dateTo: ate || undefined,
      offset,
      rangeEnd,
    }),
    getFinancialSummary(supabase, membership.clinicId, {
      professionalId: professional.id,
      dateFrom: de || undefined,
      dateTo: ate || undefined,
    }),
  ])

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Meu financeiro"
        description={`Movimentação dos atendimentos de ${professional.full_name}.`}
      />

      <FinancialSummaryCards summary={summary} showProfessionalBreakdown={false} />

      <div className="grid gap-4">
        <OwnFinancialFilters values={{ de, ate }} />
        <div className="grid gap-3">
          {/* canManage={false}: esta tela é de consulta — registrar pagamento e cancelar
              lançamento continuam sendo do financeiro/recepção. */}
          <TransactionsTable transactions={rows} paymentMethods={[]} canManage={false} />
          <PaginationBar total={total} page={page} pageSize={pageSize} label="lançamentos" />
        </div>
      </div>
    </div>
  )
}
