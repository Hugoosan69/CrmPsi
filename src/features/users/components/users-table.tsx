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
import type { Database } from "@/types/supabase"
import type { ClinicMember } from "@/services/users.service"
import type { SpecialtyOption } from "@/types/options"
import { MemberRoleSelect } from "./member-role-select"
import { UserRowActions } from "./user-row-actions"

type Role = Pick<Database["public"]["Tables"]["roles"]["Row"], "id" | "name">

export function UsersTable({
  members,
  roles,
  specialties = [],
  unlinkedProfessionals = [],
  linkedUserIds = [],
}: {
  members: ClinicMember[]
  roles: Role[]
  specialties?: SpecialtyOption[]
  unlinkedProfessionals?: { id: string; full_name: string }[]
  /** Quem já tem ficha — para não oferecer criar outra. */
  linkedUserIds?: string[]
}) {
  const linked = new Set(linkedUserIds)
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
          <TableHead className="hidden md:table-cell">E-mail</TableHead>
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
              {/* O e-mail perde a coluna abaixo de `md`, mas é ele que identifica a conta
                  quando há dois nomes iguais — desce para cá em vez de sumir. */}
              <p className="text-xs font-normal text-muted-foreground md:hidden">
                {member.email}
              </p>
            </TableCell>
            <TableCell className="hidden md:table-cell">{member.email}</TableCell>
            <TableCell>
              <MemberRoleSelect membershipId={member.membershipId} roleId={member.roleId} roles={roles} />
            </TableCell>
            <TableCell>
              <UserRowActions
                member={member}
                roles={roles}
                specialties={specialties}
                unlinkedProfessionals={unlinkedProfessionals}
                alreadyLinked={linked.has(member.userId)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
