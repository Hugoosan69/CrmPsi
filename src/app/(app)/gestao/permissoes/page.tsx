import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { listRoles } from "@/services/users.service"
import { listPermissions, listRolePermissions } from "@/services/permissions.service"
import { PageHeader } from "@/components/shared/page-header"
import { PermissionMatrix } from "@/features/users/components/permission-matrix"

export default async function PermissionsPage() {
  const membership = await requirePermission(PERMISSIONS.USERS_MANAGE)
  const supabase = await createClient()

  const roles = await listRoles(supabase, membership.clinicId)
  const [permissions, rolePermissions] = await Promise.all([
    listPermissions(supabase),
    listRolePermissions(supabase, roles.map((r) => r.id)),
  ])

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Permissões"
        description="O que cada papel pode fazer. Alterações valem para todos os usuários daquele papel na clínica."
      />
      <PermissionMatrix roles={roles} permissions={permissions} initialGranted={rolePermissions} />
    </div>
  )
}
