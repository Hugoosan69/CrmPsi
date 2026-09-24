import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import type { AuditLogRow } from "@/services/audit.service"
import { ACTION_LABELS, ENTITY_LABELS } from "./audit-labels"
import { AuditDetailDialog } from "./audit-detail-dialog"

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso))
}

export function AuditLogTable({ rows }: { rows: AuditLogRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Nenhum registro encontrado"
        description="Ajuste os filtros ou aguarde novas ações no sistema."
      />
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="whitespace-nowrap">Quando</TableHead>
          <TableHead>Ação</TableHead>
          <TableHead className="hidden md:table-cell">Entidade</TableHead>
          <TableHead className="hidden sm:table-cell">Usuário</TableHead>
          <TableHead className="w-1" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
              {formatDateTime(row.createdAt)}
            </TableCell>
            <TableCell className="font-medium">
              {ACTION_LABELS[row.action] ?? row.action}
              <p className="text-xs font-normal text-muted-foreground sm:hidden">
                {row.userName ?? "Sistema"}
              </p>
            </TableCell>
            <TableCell className="hidden md:table-cell">
              <Badge variant="secondary" className="font-normal">
                {ENTITY_LABELS[row.entityType] ?? row.entityType}
              </Badge>
            </TableCell>
            <TableCell className="hidden sm:table-cell">{row.userName ?? "Sistema"}</TableCell>
            <TableCell>
              <AuditDetailDialog row={row} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
