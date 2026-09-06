import { EmptyState } from "@/components/shared/empty-state"
import { ProfessionalRowActions } from "./professional-row-actions"
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
import type { RoleOption } from "@/types/options"
import { CreateUserForProfessionalDialog } from "./create-user-for-professional-dialog"

type Professional = Database["public"]["Tables"]["professionals"]["Row"]
type Specialty = Pick<Database["public"]["Tables"]["specialties"]["Row"], "id" | "name">

export function ProfessionalsTable({
  professionals,
  specialties,
  roles,
  canManageUsers,
}: {
  professionals: Professional[]
  specialties: Specialty[]
  roles: RoleOption[]
  /**
   * Criar login é `users.manage`, não `professionals.manage`. Cuidar da equipe clínica não
   * é o mesmo que decidir quem entra no sistema — quem só tem esta tela vê a coluna de
   * acesso, para saber quem já entra, mas não o botão. A Server Action confere de novo.
   */
  canManageUsers: boolean
}) {
  const specialtyName = new Map(specialties.map((s) => [s.id, s.name]))

  if (professionals.length === 0) {
    return (
      <EmptyState title="Nenhum profissional cadastrado." />
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Especialidade</TableHead>
          <TableHead className="hidden xl:table-cell">Registro</TableHead>
          <TableHead className="hidden lg:table-cell">Contato</TableHead>
          <TableHead className="hidden md:table-cell">Acesso</TableHead>
          <TableHead className="w-1" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {professionals.map((professional) => (
          <TableRow key={professional.id}>
            <TableCell className="font-medium">
              <span className="mr-2 inline-block size-2 rounded-full align-middle" style={{ backgroundColor: professional.color }} />
              {professional.full_name}
              {!professional.active && (
                <Badge variant="secondary" className="ml-2">
                  Inativo
                </Badge>
              )}
              {/* Contato tem coluna própria só a partir de `lg`; abaixo disso desce para
                  cá, porque é o dado que a gestão usa para falar com a pessoa. */}
              {(professional.phone || professional.email) && (
                <p className="text-xs font-normal text-muted-foreground lg:hidden">
                  {professional.phone || professional.email}
                </p>
              )}
            </TableCell>
            <TableCell>
              {professional.specialty_id ? specialtyName.get(professional.specialty_id) ?? "—" : "—"}
            </TableCell>
            <TableCell className="hidden xl:table-cell">{professional.professional_register || "—"}</TableCell>
            <TableCell className="hidden lg:table-cell">{professional.phone || professional.email || "—"}</TableCell>
            <TableCell className="hidden md:table-cell">
              {professional.user_id ? (
                <Badge variant="secondary">Tem login</Badge>
              ) : canManageUsers ? (
                <CreateUserForProfessionalDialog professional={professional} roles={roles} />
              ) : (
                <span className="text-muted-foreground">Sem login</span>
              )}
            </TableCell>
            <TableCell>
              <ProfessionalRowActions professional={professional} specialties={specialties} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
