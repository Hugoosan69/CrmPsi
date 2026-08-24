import { Suspense } from "react"

import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { listPatients } from "@/services/patients.service"
import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { PatientSearchInput } from "@/features/patients/components/patient-search-input"
import { PatientsTable } from "@/features/patients/components/patients-table"
import { CreatePatientDialog } from "@/features/patients/components/create-patient-dialog"

async function PatientsList({ search }: { search?: string }) {
  const membership = await requirePermission(PERMISSIONS.PATIENTS_VIEW)
  const supabase = await createClient()
  const patients = await listPatients(supabase, membership.clinicId, { search })

  return <PatientsTable patients={patients} profileBasePath="/recepcao/pacientes" />
}

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>
}) {
  const { busca } = await searchParams

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
      <Suspense fallback={<TableSkeleton columns={5} />}>
        <PatientsList search={busca} />
      </Suspense>
    </div>
  )
}
