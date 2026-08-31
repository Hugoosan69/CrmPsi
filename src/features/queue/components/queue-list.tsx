"use client"

import { useTransition } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { cn } from "@/lib/utils"
import { formatTime } from "@/utils/datetime"
import type { QueueEntryView } from "@/services/queue.service"
import { callQueueEntryAction, cancelQueueEntryAction, getQueueSnapshotAction } from "../actions/queue.actions"
import { PaymentGateBoard } from "./payment-gate-board"
import { QueueStatusBadge } from "./queue-status-badge"
import { CallingNow } from "./calling-now"

const ENTRY_TYPE_LABEL: Record<string, string> = {
  scheduled: "Agendado",
  walk_in: "Encaixe",
  fit_in: "Encaixe",
  transfer: "Transferido",
}

type PaymentMethod = { id: string; name: string }

export function QueueList({ paymentMethods }: { paymentMethods: PaymentMethod[] }) {
  const queryClient = useQueryClient()
  const { data: all, isLoading, error } = useQuery({
    queryKey: ["queue", "recepcao"],
    queryFn: () => getQueueSnapshotAction(),
    refetchInterval: 5000,
    retry: false,
  })
  const [isPending, startTransition] = useTransition()

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["queue"] })
  }

  if (isLoading) {
    return <TableSkeleton columns={6} />
  }

  if (error) {
    return (
      <div
        className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm"
        role="alert"
      >
        <p className="font-medium text-destructive">Não foi possível carregar a fila</p>
        <p className="mt-1 text-muted-foreground">{error.message}</p>
      </div>
    )
  }

  // Split the two bands: reception owns the payment gate, and only what's past it is
  // an actual queue.
  const gated = (all ?? []).filter((e) => e.status === "payment_pending" || e.status === "released")
  const data = (all ?? []).filter((e) => e.status !== "payment_pending" && e.status !== "released")

  const gateBoard = <PaymentGateBoard entries={gated} paymentMethods={paymentMethods} />

  if (data.length === 0) {
    return (
      <div className="grid gap-6">
        {gateBoard}
        <EmptyState
          title="Fila vazia no momento"
          description="Pacientes entram na fila após o pagamento ser confirmado e liberado pela recepção."
        />
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      {/* Busca as chamadas por conta própria, na mesma chave do avisador — e devolve null
          quando não há nenhuma. */}
      <CallingNow />
      {gateBoard}
      <QueueTable data={data} isPending={isPending} startTransition={startTransition} invalidate={invalidate} />
    </div>
  )
}

function QueueTable({
  data,
  isPending,
  startTransition,
  invalidate,
}: {
  data: QueueEntryView[]
  isPending: boolean
  startTransition: (fn: () => void) => void
  invalidate: () => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Paciente</TableHead>
          <TableHead>Profissional</TableHead>
          <TableHead>Origem</TableHead>
          <TableHead>Chegada</TableHead>
          <TableHead>Espera</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-1" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="font-medium">{entry.patientName}</TableCell>
            <TableCell className="text-muted-foreground">{entry.professionalName || "—"}</TableCell>
            <TableCell className="text-muted-foreground">
              {ENTRY_TYPE_LABEL[entry.entry_type] ?? entry.entry_type}
            </TableCell>
            <TableCell className="text-muted-foreground">{formatTime(entry.arrived_at)}</TableCell>
            <TableCell
              className={cn(
                entry.waitingMinutes >= 20 ? "font-medium text-status-warning" : "text-muted-foreground"
              )}
            >
              {entry.waitingMinutes === 0 ? "agora" : `${entry.waitingMinutes} min`}
            </TableCell>
            <TableCell>
              <QueueStatusBadge status={entry.status} />
            </TableCell>
            <TableCell className="flex justify-end gap-1 text-right">
              {entry.status === "waiting" && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => startTransition(async () => {
                    await callQueueEntryAction(entry.id)
                    invalidate()
                  })}
                >
                  Chamar
                </Button>
              )}
              {(entry.status === "waiting" || entry.status === "called") && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => startTransition(async () => {
                    await cancelQueueEntryAction(entry.id)
                    invalidate()
                  })}
                >
                  Cancelar
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
