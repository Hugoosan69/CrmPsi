import { Suspense } from "react"
import { redirect } from "next/navigation"

import { requireAreaAccess } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { getProfessionalByUserId } from "@/services/professionals.service"
import { listLinkedPatients } from "@/services/professional-links.service"
import { parsePagination } from "@/config/pagination"
import { PageHeader } from "@/components/shared/page-header"
import { PaginationBar } from "@/components/shared/pagination-bar"
import { PatientSearchInput } from "@/features/patients/components/patient-search-input"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { MyPatientsTable } from "@/features/patients/components/my-patients-table"

type SearchParams = { busca?: string; pagina?: string; por?: string }

async function MyPatientsList({ busca, pagina, por }: SearchParams) {
  const membership = await requireAreaAccess(
    PERMISSIONS.PROFESSIONAL_ACCESS,
    PERMISSIONS.PATIENTS_VIEW
  )
  const supabase = await createClient()

  const professional = await getProfessionalByUserId(
    supabase,
    membership.clinicId,
    membership.userId
  )
  if (!professional) redirect("/dashboard?error=no-professional")

  const { page, pageSize, offset, rangeEnd } = parsePagination({
    page: pagina,
    pageSize: por,
  })
  const { rows, total } = await listLinkedPatients(
    supabase,
    membership.clinicId,
    professional.id,
    { search: busca, offset, rangeEnd }
  )

  return (
    <div className="grid gap-3">
      <MyPatientsTable patients={rows} />
      <PaginationBar total={total} page={page} pageSize={pageSize} label="pacientes" />
    </div>
  )
}

export default async function MeusPacientesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const { busca, pagina, por } = params

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Meus pacientes"
        description="Pacientes que você atende ou que foram vinculados a você."
      />
      <Suspense fallback={null}>
        <PatientSearchInput />
      </Suspense>
      <Suspense
        key={[busca, pagina, por].map((v) => v ?? "").join("|")}
        fallback={<TableSkeleton columns={5} />}
      >
        <MyPatientsList {...params} />
      </Suspense>
    </div>
  )
}
