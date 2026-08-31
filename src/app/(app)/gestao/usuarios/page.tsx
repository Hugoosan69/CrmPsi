import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import {
  listClinicMembers,
  listLinkedProfessionalUserIds,
  listRoles,
  listUnlinkedProfessionals,
} from "@/services/users.service"
import { listSpecialties } from "@/services/professionals.service"
import { parsePagination } from "@/config/pagination"
import { PageHeader } from "@/components/shared/page-header"
import { PaginationBar } from "@/components/shared/pagination-bar"
import { UsersTable } from "@/features/users/components/users-table"
import { InviteUserDialog } from "@/features/users/components/invite-user-dialog"

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; por?: string }>
}) {
  const membership = await requirePermission(PERMISSIONS.USERS_MANAGE)
  const supabase = await createClient()

  const { pagina, por } = await searchParams
  const { page, pageSize, offset, rangeEnd } = parsePagination({ page: pagina, pageSize: por })
  // Especialidades vêm junto porque criar um usuário pode criar a ficha de profissional
  // na mesma ação — sem elas o formulário não teria como classificar quem atende.
  const [members, roles, specialties, unlinked, linkedIds] = await Promise.all([
    listClinicMembers(supabase, membership.clinicId, { offset, rangeEnd }),
    listRoles(supabase, membership.clinicId),
    listSpecialties(supabase, membership.clinicId),
    listUnlinkedProfessionals(supabase, membership.clinicId),
    listLinkedProfessionalUserIds(supabase, membership.clinicId),
  ])

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Usuários"
        description="Acesso ao sistema e papel de cada pessoa."
        actions={<InviteUserDialog roles={roles} specialties={specialties} />}
      />
      <div className="grid gap-3">
        <UsersTable
          members={members.rows}
          roles={roles}
          specialties={specialties}
          unlinkedProfessionals={unlinked}
          linkedUserIds={[...linkedIds]}
        />
        <PaginationBar
          total={members.total}
          page={page}
          pageSize={pageSize}
          label="usuários"
        />
      </div>
    </div>
  )
}
