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
import { setProfessionalActiveAction } from "../actions/professional.actions"
import { EditProfessionalDialog } from "./edit-professional-dialog"

type Professional = Database["public"]["Tables"]["professionals"]["Row"]
type Specialty = Pick<Database["public"]["Tables"]["specialties"]["Row"], "id" | "name">

export function ProfessionalsTable({
  professionals,
  specialties,
}: {
  professionals: Professional[]
  specialties: Specialty[]
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
          <TableHead>Registro</TableHead>
          <TableHead>Contato</TableHead>
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
            </TableCell>
            <TableCell>
              {professional.specialty_id ? specialtyName.get(professional.specialty_id) ?? "—" : "—"}
            </TableCell>
            <TableCell>{professional.professional_register || "—"}</TableCell>
            <TableCell>{professional.phone || professional.email || "—"}</TableCell>
            <TableCell className="flex justify-end gap-1 text-right">
              <EditProfessionalDialog professional={professional} specialties={specialties} />
              <ToggleActiveButton
                active={professional.active}
                deactivateLabel="Inativar"
                confirmTitle={professional.active ? "Inativar profissional?" : "Ativar profissional?"}
                confirmDescription={
                  professional.active
                    ? "O profissional deixará de aparecer para novos agendamentos."
                    : "O profissional voltará a aparecer para novos agendamentos."
                }
                action={setProfessionalActiveAction.bind(null, professional.id, !professional.active)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
