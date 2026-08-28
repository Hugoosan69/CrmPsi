import { EmptyState } from "@/components/shared/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ToggleActiveButton } from "@/components/shared/toggle-active-button"
import type { Database } from "@/types/supabase"
import type { ClinicMember } from "@/services/users.service"
import { setMembershipActiveAction } from "../actions/user.actions"
import { MemberRoleSelect } from "./member-role-select"
import { SendResetButton } from "./send-reset-button"
import { EditUserDialog } from "./edit-user-dialog"

type Role = Pick<Database["public"]["Tables"]["roles"]["Row"], "id" | "name">

export function UsersTable({ members, roles }: { members: ClinicMember[]; roles: Role[] }) {
  if (members.length === 0) {
    return (
      <EmptyState title="Nenhum usuário cadastrado ainda." />
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>E-mail</TableHead>
          <TableHead>Papel</TableHead>
          <TableHead className="w-1" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.membershipId}>
            <TableCell className="font-medium">
              {member.fullName}
              {!member.active && (
                <Badge variant="secondary" className="ml-2">
                  Inativo
                </Badge>
              )}
            </TableCell>
            <TableCell>{member.email}</TableCell>
            <TableCell>
              <MemberRoleSelect membershipId={member.membershipId} roleId={member.roleId} roles={roles} />
            </TableCell>
            <TableCell className="text-right whitespace-nowrap">
              <EditUserDialog member={member} roles={roles} />
              {/* Only for members who can still sign in — a recovery link is useless to a
                  deactivated account, which the session layer refuses regardless. */}
              {member.active && (
                <SendResetButton
                  membershipId={member.membershipId}
                  memberName={member.fullName}
                  memberEmail={member.email}
                />
              )}
              <ToggleActiveButton
                active={member.active}
                deactivateLabel="Inativar"
                confirmTitle={member.active ? "Inativar usuário?" : "Ativar usuário?"}
                confirmDescription={
                  member.active
                    ? "O usuário perde acesso imediato ao sistema."
                    : "O usuário volta a ter acesso ao sistema."
                }
                action={setMembershipActiveAction.bind(null, member.membershipId, !member.active)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
