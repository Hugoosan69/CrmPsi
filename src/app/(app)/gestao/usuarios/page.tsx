import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { listClinicMembers, listRoles } from "@/services/users.service"
import { PageHeader } from "@/components/shared/page-header"
import { UsersTable } from "@/features/users/components/users-table"
import { InviteUserDialog } from "@/features/users/components/invite-user-dialog"

export default async function UsersPage() {
  const membership = await requirePermission(PERMISSIONS.USERS_MANAGE)
  const supabase = await createClient()
  const [members, roles] = await Promise.all([
    listClinicMembers(supabase, membership.clinicId),
    listRoles(supabase, membership.clinicId),
  ])

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Usuários"
        description="Acesso ao sistema e papel de cada pessoa."
        actions={<InviteUserDialog roles={roles} />}
      />
      <UsersTable members={members} roles={roles} />
    </div>
  )
}
