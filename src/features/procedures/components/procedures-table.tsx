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
import { setProcedureActiveAction } from "../actions/procedure.actions"
import { EditProcedureDialog } from "./edit-procedure-dialog"

type Procedure = Database["public"]["Tables"]["procedures"]["Row"]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

export function ProceduresTable({ procedures }: { procedures: Procedure[] }) {
  if (procedures.length === 0) {
    return (
      <EmptyState title="Nenhum procedimento cadastrado." />
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Duração</TableHead>
          <TableHead>Preço</TableHead>
          <TableHead className="w-1" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {procedures.map((procedure) => (
          <TableRow key={procedure.id}>
            <TableCell className="font-medium">
              {procedure.name}
              {!procedure.active && (
                <Badge variant="secondary" className="ml-2">
                  Inativo
                </Badge>
              )}
              {procedure.description && (
                <p className="text-xs font-normal text-muted-foreground">{procedure.description}</p>
              )}
            </TableCell>
            <TableCell>{procedure.duration_minutes} min</TableCell>
            <TableCell>{formatCurrency(procedure.price)}</TableCell>
            <TableCell className="flex justify-end gap-1 text-right">
              <EditProcedureDialog procedure={procedure} />
              <ToggleActiveButton
                active={procedure.active}
                deactivateLabel="Inativar"
                confirmTitle={procedure.active ? "Inativar procedimento?" : "Ativar procedimento?"}
                confirmDescription={
                  procedure.active
                    ? "O procedimento deixará de aparecer para novos agendamentos."
                    : "O procedimento voltará a aparecer para novos agendamentos."
                }
                action={setProcedureActiveAction.bind(null, procedure.id, !procedure.active)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
