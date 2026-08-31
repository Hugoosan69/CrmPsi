import { Suspense } from "react"

import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { listPatients } from "@/services/patients.service"
import { parsePagination } from "@/config/pagination"
import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { PatientSearchInput } from "@/features/patients/components/patient-search-input"
import { PatientsTable } from "@/features/patients/components/patients-table"
import { PaginationBar } from "@/components/shared/pagination-bar"
import { CreatePatientDialog } from "@/features/patients/components/create-patient-dialog"

async function PatientsList({
  search,
  pagina,
  por,
}: {
  search?: string
  pagina?: string
  por?: string
}) {
  const membership = await requirePermission(PERMISSIONS.PATIENTS_VIEW)
  const supabase = await createClient()

  const { page, pageSize, offset, rangeEnd } = parsePagination({ page: pagina, pageSize: por })
  const { rows, total } = await listPatients(supabase, membership.clinicId, {
    search,
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
  searchParams: Promise<{ busca?: string; pagina?: string; por?: string }>
}) {
  const { busca, pagina, por } = await searchParams

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
      {/* A chave remonta o Suspense a cada mudança de busca ou de página, para o esqueleto
          aparecer de novo em vez de a tabela antiga ficar parada esperando a nova. */}
      <Suspense key={`${busca ?? ""}|${pagina ?? ""}|${por ?? ""}`} fallback={<TableSkeleton columns={5} />}>
        <PatientsList search={busca} pagina={pagina} por={por} />
      </Suspense>
    </div>
  )
}
