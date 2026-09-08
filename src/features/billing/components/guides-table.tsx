import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { GuideRow } from "@/services/billing.service"
import { GuideRowActions } from "./guide-row-actions"

const STATUS_LABEL: Record<string, string> = {
  emitida: "Emitida",
  enviada: "Enviada",
  paga: "Paga",
  glosada: "Glosada",
  recusada: "Recusada",
  cancelada: "Cancelada",
}

/** Glosa e recusa são as que exigem ação da clínica — é o que a cor precisa destacar. */
function statusVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "paga") return "default"
  if (status === "glosada" || status === "recusada") return "destructive"
  return "secondary"
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(
    new Date(value)
  )
}

/**
 * As guias emitidas.
 *
 * Uma tabela para os dois lugares — a ficha do paciente e a tela de gestão —, porque a
 * diferença entre eles é uma coluna. Na ficha o paciente já é o título da página, e
 * repeti-lo em cada linha só gastaria largura.
 */
export function GuidesTable({
  guides,
  showPatient = true,
  canManage = false,
  emptyTitle = "Nenhuma guia emitida",
  emptyDescription,
}: {
  guides: GuideRow[]
  showPatient?: boolean
  /** `billing.manage` — só quem tem pode excluir uma guia. */
  canManage?: boolean
  emptyTitle?: string
  emptyDescription?: string
}) {
  if (guides.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} showMascot={false} />
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Guia</TableHead>
            {showPatient && <TableHead>Paciente</TableHead>}
            <TableHead>Convênio</TableHead>
            <TableHead className="hidden md:table-cell">Atendimento</TableHead>
            <TableHead className="hidden lg:table-cell">Especialidade</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead className="w-1" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {guides.map((g) => (
            <TableRow key={g.id}>
              <TableCell className="font-medium tabular-nums">
                {g.guideNumber ?? "—"}
                <span className="block text-[0.72rem] font-normal text-muted-foreground">
                  emitida em {formatDate(g.issuedAt)}
                </span>
              </TableCell>
              {showPatient && <TableCell>{g.patientName}</TableCell>}
              <TableCell>{g.insurerName}</TableCell>
              <TableCell className="hidden text-[0.8rem] text-muted-foreground md:table-cell">
                {formatDate(g.scheduledAt)}
                {g.procedureName && <span className="block">{g.procedureName}</span>}
              </TableCell>
              <TableCell className="hidden text-[0.8rem] text-muted-foreground lg:table-cell">
                {g.specialtyName ?? "—"}
                {g.professionalName && (
                  <span className="block">{g.professionalName}</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant(g.status)}>
                  {STATUS_LABEL[g.status] ?? g.status}
                </Badge>
              </TableCell>
              <TableCell>
                <GuideRowActions guide={g} canManage={canManage} />
                {!g.attachmentKey && (
                  <span className="block text-right text-[0.7rem] text-muted-foreground">
                    sem anexo
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
