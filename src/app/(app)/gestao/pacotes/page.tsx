import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { listSessionPackages } from "@/services/packages.service"
import { listSpecialties } from "@/services/professionals.service"
import { PageHeader } from "@/components/shared/page-header"
import { PackageCatalogTable } from "@/features/packages/components/package-catalog-table"
import { CreatePackageDialog } from "@/features/packages/components/create-package-dialog"

export default async function PackagesPage() {
  const membership = await requirePermission(PERMISSIONS.PACKAGES_MANAGE)
  const supabase = await createClient()

  const [packages, specialties] = await Promise.all([
    listSessionPackages(supabase, membership.clinicId),
    listSpecialties(supabase, membership.clinicId),
  ])

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Pacotes"
        description="Catálogo de pacotes de sessões por especialidade."
        actions={<CreatePackageDialog specialties={specialties ?? []} />}
      />
      <PackageCatalogTable packages={packages} specialties={specialties ?? []} />
    </div>
  )
}
