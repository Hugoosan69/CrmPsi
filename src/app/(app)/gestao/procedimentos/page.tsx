import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { listProcedures } from "@/services/procedures.service"
import { PageHeader } from "@/components/shared/page-header"
import { ProceduresTable } from "@/features/procedures/components/procedures-table"
import { CreateProcedureDialog } from "@/features/procedures/components/create-procedure-dialog"

export default async function ProceduresPage() {
  const membership = await requirePermission(PERMISSIONS.SETTINGS_MANAGE)
  const supabase = await createClient()
  const procedures = await listProcedures(supabase, membership.clinicId)

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Procedimentos"
        description="Catálogo de procedimentos, duração e preço."
        actions={<CreateProcedureDialog />}
      />
      <ProceduresTable procedures={procedures} />
    </div>
  )
}
