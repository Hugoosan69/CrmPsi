import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { listProfessionals, listSpecialties } from "@/services/professionals.service"
import { PageHeader } from "@/components/shared/page-header"
import { ProfessionalsTable } from "@/features/professionals/components/professionals-table"
import { CreateProfessionalDialog } from "@/features/professionals/components/create-professional-dialog"

export default async function ProfessionalsPage() {
  const membership = await requirePermission(PERMISSIONS.SETTINGS_MANAGE)
  const supabase = await createClient()
  const [professionals, specialties] = await Promise.all([
    listProfessionals(supabase, membership.clinicId),
    listSpecialties(supabase, membership.clinicId),
  ])

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Profissionais"
        description="Equipe clínica, especialidades e agenda."
        actions={<CreateProfessionalDialog specialties={specialties} />}
      />
      <ProfessionalsTable professionals={professionals} specialties={specialties} />
    </div>
  )
}
