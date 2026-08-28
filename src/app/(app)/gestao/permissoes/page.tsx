import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { listClinicMembers } from "@/services/users.service"
import { listEffectivePermissions } from "@/services/permissions.service"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { UserPermissionMatrix } from "@/features/users/components/user-permission-matrix"

export default async function PermissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ usuario?: string }>
}) {
  const membership = await requirePermission(PERMISSIONS.USERS_MANAGE)
  const { usuario } = await searchParams
  const supabase = await createClient()

  const members = await listClinicMembers(supabase, membership.clinicId)

  // A seleção vive na URL, então a tela é linkável e sobrevive a um refresh. Um id que não
  // pertence a esta clínica é ignorado em vez de consultado — a lista de membros já está
  // filtrada por clínica, então isso também impede espiar permissões de outro tenant.
  const selectedUserId =
    usuario && members.some((m) => m.userId === usuario)
      ? usuario
      : (members[0]?.userId ?? null)

  const permissions = selectedUserId
    ? await listEffectivePermissions(supabase, membership.clinicId, selectedUserId)
    : []

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Permissões"
        description="O papel define o padrão de cada pessoa. Aqui você abre exceções individuais, sem afetar quem tem o mesmo papel."
      />
      {members.length === 0 ? (
        <EmptyState title="Nenhum usuário cadastrado ainda." />
      ) : (
        <UserPermissionMatrix
          // Remonta ao trocar de pessoa, descartando o estado otimista da anterior.
          key={selectedUserId}
          members={members}
          selectedUserId={selectedUserId ?? ""}
          permissions={permissions}
        />
      )}
    </div>
  )
}
