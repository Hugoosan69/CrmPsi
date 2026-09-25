import { requireAreaAccess } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { listProceduresPage } from "@/services/procedures.service"
import { parsePagination } from "@/config/pagination"
import { PageHeader } from "@/components/shared/page-header"
import { PaginationBar } from "@/components/shared/pagination-bar"
import { ListFilters } from "@/components/shared/list-filters"
import { ProceduresTable } from "@/features/procedures/components/procedures-table"
import { CreateProcedureDialog } from "@/features/procedures/components/create-procedure-dialog"

export default async function ProceduresPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; por?: string; busca?: string; status?: string }>
}) {
  const membership = await requireAreaAccess(PERMISSIONS.MANAGEMENT_ACCESS, PERMISSIONS.CATALOG_MANAGE)
  const supabase = await createClient()

  const { pagina, por, busca, status } = await searchParams
  const { page, pageSize, offset, rangeEnd } = parsePagination({ page: pagina, pageSize: por })
  const { rows, total } = await listProceduresPage(supabase, membership.clinicId, {
    offset,
    rangeEnd,
    search: busca,
    active: status === "ativo" ? true : status === "inativo" ? false : undefined,
  })

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Procedimentos"
        description="Catálogo de procedimentos, duração e preço."
        actions={<CreateProcedureDialog />}
      />
      <ListFilters
        fields={[
          { type: "search", key: "busca", label: "Buscar", placeholder: "Nome do procedimento" },
          {
            type: "select",
            key: "status",
            label: "Situação",
            placeholder: "Todas",
            options: [
              { value: "ativo", label: "Ativos" },
              { value: "inativo", label: "Inativos" },
            ],
          },
        ]}
      />
      <div className="grid gap-3">
        <ProceduresTable procedures={rows} />
        <PaginationBar total={total} page={page} pageSize={pageSize} label="procedimentos" />
      </div>
    </div>
  )
}
