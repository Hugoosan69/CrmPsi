import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { listClinicMembers, listRoles } from "@/services/users.service"
import { listSpecialties } from "@/services/professionals.service"
import { PageHeader } from "@/components/shared/page-header"
import { UsersTable } from "@/features/users/components/users-table"
import { InviteUserDialog } from "@/features/users/components/invite-user-dialog"

export default async function UsersPage() {
  const membership = await requirePermission(PERMISSIONS.USERS_MANAGE)
  const supabase = await createClient()
  // Especialidades vêm junto porque criar um usuário pode criar a ficha de profissional
  // na mesma ação — sem elas o formulário não teria como classificar quem atende.
  const [members, roles, specialties] = await Promise.all([
    listClinicMembers(supabase, membership.clinicId),
    listRoles(supabase, membership.clinicId),
    listSpecialties(supabase, membership.clinicId),
  ])

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Usuários"
        description="Acesso ao sistema e papel de cada pessoa."
        actions={<InviteUserDialog roles={roles} specialties={specialties} />}
      />
      <UsersTable members={members} roles={roles} />
    </div>
  )
}
