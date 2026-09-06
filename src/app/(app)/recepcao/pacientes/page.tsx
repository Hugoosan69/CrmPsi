import { Suspense } from "react"

import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import {
  listPatientsWithStats,
  type PatientPackageFilter,
  type PatientSort,
  type PatientStatusFilter,
} from "@/services/patients.service"
import { parsePagination } from "@/config/pagination"
import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { PatientSearchInput } from "@/features/patients/components/patient-search-input"
import { PatientsTable } from "@/features/patients/components/patients-table"
import { PatientsFilters } from "@/features/patients/components/patients-filters"
import { PaginationBar } from "@/components/shared/pagination-bar"
import { CreatePatientDialog } from "@/features/patients/components/create-patient-dialog"

type SearchParams = {
  busca?: string
  pagina?: string
  por?: string
  status?: string
  pacote?: string
  contato?: string
  ordem?: string
}

/** Padrão: só ativos. "todos" e "inativos" são escolhas explícitas. */
function parseStatus(value?: string): PatientStatusFilter {
  return value === "inativos" || value === "todos" ? value : "ativos"
}

function parsePackages(value?: string): PatientPackageFilter | undefined {
  return value === "com" || value === "sem" ? value : undefined
}

function parseSort(value?: string): PatientSort {
  return value === "recentes" ? "recentes" : "nome"
}

async function PatientsList({ busca, pagina, por, status, pacote, contato, ordem }: SearchParams) {
  const membership = await requirePermission(PERMISSIONS.PATIENTS_VIEW)
  const supabase = await createClient()

  const { page, pageSize, offset, rangeEnd } = parsePagination({ page: pagina, pageSize: por })
  const { rows, total } = await listPatientsWithStats(supabase, membership.clinicId, {
    search: busca,
    status: parseStatus(status),
    packages: parsePackages(pacote),
    missingContact: contato === "sem",
    sort: parseSort(ordem),
    offset,
    rangeEnd,
  })

  return (
    <div className="grid gap-3">
      <PatientsTable patients={rows} profileBasePath="/recepcao/pacientes" />
      <PaginationBar total={total} page={page} pageSize={pageSize} label="pacientes" />
    </div>
  )
}

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const { busca, pagina, por, status, pacote, contato, ordem } = params

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Pacientes"
        description="Cadastro, busca e edição de pacientes."
        actions={<CreatePatientDialog />}
      />
      <Suspense fallback={null}>
        <PatientSearchInput />
      </Suspense>
      {/* Os filtros são um componente de cliente que só lê a URL — fica fora do Suspense da
          lista de propósito, para continuar clicável enquanto a tabela recarrega. */}
      <Suspense fallback={null}>
        <PatientsFilters values={{ status, pacote, contato, ordem }} />
      </Suspense>
      {/* A chave remonta o Suspense a cada mudança de busca, filtro ou página, para o
          esqueleto aparecer de novo em vez de a tabela antiga ficar parada esperando. */}
      <Suspense
        key={[busca, pagina, por, status, pacote, contato, ordem].map((v) => v ?? "").join("|")}
        fallback={<TableSkeleton columns={7} />}
      >
        <PatientsList {...params} />
      </Suspense>
    </div>
  )
}
