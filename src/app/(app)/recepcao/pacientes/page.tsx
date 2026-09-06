import { Suspense } from "react"

import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { listPatientsWithStats } from "@/services/patients.service"
import { parsePagination } from "@/config/pagination"
import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { PatientSearchInput } from "@/features/patients/components/patient-search-input"
import { PatientsTable } from "@/features/patients/components/patients-table"
import { PatientsFilters } from "@/features/patients/components/patients-filters"
import { PaginationBar } from "@/components/shared/pagination-bar"
import { CreatePatientDialog } from "@/features/patients/components/create-patient-dialog"

async function PatientsList({
  search,
  pagina,
  por,
  status,
  especialidade,
}: {
  search?: string
  pagina?: string
  por?: string
  status?: string
  especialidade?: string
}) {
  const membership = await requirePermission(PERMISSIONS.PATIENTS_VIEW)
  const supabase = await createClient()

  const { page, pageSize, offset, rangeEnd } = parsePagination({ page: pagina, pageSize: por })
  const { rows, total } = await listPatientsWithStats(supabase, membership.clinicId, {
    search,
    offset,
    rangeEnd,
    specialtyId: especialidade,
    activeOnly: status !== "inativo",
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
  searchParams: Promise<{ busca?: string; pagina?: string; por?: string; status?: string; especialidade?: string }>
}) {
  const { busca, pagina, por, status, especialidade } = await searchParams
  const membership = await requirePermission(PERMISSIONS.PATIENTS_VIEW)
  const supabase = await createClient()

  // Busca especialidades para o filtro
  const { data: specialties } = await supabase
    .from("specialties")
    .select("id, name")
    .eq("clinic_id", membership.clinicId)
    .order("name")

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
      <PatientsFilters
        values={{ status, especialidade }}
        specialties={specialties ?? []}
      />
      {/* A chave remonta o Suspense a cada mudança de busca ou de página, para o esqueleto
          aparecer de novo em vez de a tabela antiga ficar parada esperando a nova. */}
      <Suspense key={`${busca ?? ""}|${pagina ?? ""}|${por ?? ""}|${status ?? ""}|${especialidade ?? ""}`} fallback={<TableSkeleton columns={5} />}>
        <PatientsList search={busca} pagina={pagina} por={por} status={status} especialidade={especialidade} />
      </Suspense>
    </div>
  )
}
