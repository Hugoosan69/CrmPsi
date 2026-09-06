import { EmptyState } from "@/components/shared/empty-state"
import { ProcedureRowActions } from "./procedure-row-actions"
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
            <TableCell>
              <ProcedureRowActions procedure={procedure} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
