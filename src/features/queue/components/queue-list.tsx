"use client"

import { useTransition } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { PhoneCall } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { formatTime } from "@/utils/datetime"
import type { QueueEntryView } from "@/services/queue.service"
import {
  callQueueEntryAction,
  cancelQueueEntryAction,
  getQueueSnapshotAction,
} from "../actions/queue.actions"
import { PaymentGateBoard } from "./payment-gate-board"
import { QueueStatusBadge } from "./queue-status-badge"
import { CallingNow } from "./calling-now"

const ENTRY_TYPE_LABEL: Record<string, string> = {
  scheduled: "Agendado",
  walk_in: "Encaixe",
  fit_in: "Encaixe",
  transfer: "Transferido",
}

/** Faixas de espera. A cor sobe junto com o tempo, para o balcão ler de longe. */
const WAIT_WARNING_MINUTES = 20
const WAIT_DANGER_MINUTES = 45

function waitClass(minutes: number) {
  if (minutes >= WAIT_DANGER_MINUTES) return "text-status-danger font-semibold"
  if (minutes >= WAIT_WARNING_MINUTES) return "text-status-warning font-medium"
  return "text-muted-foreground"
}

type PaymentMethod = { id: string; name: string }
type Insurer = { id: string; name: string; amount_per_guide: number }

/** Uma leitura do balcão inteiro em quatro números, antes de qualquer lista. */
function QueueSummary({ entries }: { entries: QueueEntryView[] }) {
  const cells = [
    {
      label: "Aguardando pagamento",
      value: entries.filter((e) => e.status === "payment_pending").length,
      tone: "text-status-danger",
    },
    {
      label: "A enviar para a fila",
      value: entries.filter((e) => e.status === "released").length,
      tone: "text-status-success",
    },
    {
      label: "Na fila",
      value: entries.filter((e) => e.status === "waiting" || e.status === "called").length,
      tone: "text-status-warning",
    },
    {
      label: "Em atendimento",
      value: entries.filter((e) => e.status === "in_service" || e.status === "paused").length,
      tone: "text-status-info",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cells.map((cell) => (
        <div key={cell.label} className="grid gap-0.5 rounded-xl border border-border bg-card p-3">
          <span
            className={cn(
              "metric text-2xl font-semibold tabular-nums",
              cell.value === 0 ? "text-muted-foreground" : cell.tone
            )}
          >
            {cell.value}
          </span>
          <span className="text-[0.75rem] leading-tight text-muted-foreground">{cell.label}</span>
        </div>
      ))}
    </div>
  )
}

export function QueueList({
  paymentMethods,
  insurers = [],
}: {
  paymentMethods: PaymentMethod[]
  insurers?: Insurer[]
}) {
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

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action()
      invalidate()
    })
  }

  if (isLoading) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    )
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

  const entries = all ?? []
  // As duas bandas: a recepção é dona do portão de pagamento, e só o que passou dele é fila.
  const gated = entries.filter((e) => e.status === "payment_pending" || e.status === "released")
  const inQueue = entries.filter(
    (e) => e.status !== "payment_pending" && e.status !== "released"
  )

  return (
    <div className="grid gap-6">
      <QueueSummary entries={entries} />

      {/* Busca as chamadas por conta própria, na mesma chave do avisador — e devolve null
          quando não há nenhuma. */}
      <CallingNow />

      <PaymentGateBoard entries={gated} paymentMethods={paymentMethods} insurers={insurers} />

      {inQueue.length === 0 ? (
        <EmptyState
          title="Ninguém na fila no momento"
          description="Pacientes entram na fila depois que o pagamento é confirmado e a recepção os envia."
        />
      ) : (
        <section className="grid gap-3">
          <div className="flex items-center gap-2.5">
            <h2 className="font-heading text-[0.95rem] font-semibold">Na fila</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-semibold tabular-nums text-muted-foreground">
              {inQueue.length}
            </span>
            <span className="h-px flex-1 bg-border" aria-hidden />
          </div>

          <ul className="overflow-hidden rounded-xl border border-border bg-card shadow-soft divide-y divide-border/70">
            {inQueue.map((entry, index) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <span className="w-5 shrink-0 text-center text-[0.78rem] font-medium tabular-nums text-muted-foreground">
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1 basis-44">
                  <p className="truncate text-[0.9rem] font-medium">{entry.patientName}</p>
                  <p className="truncate text-[0.75rem] text-muted-foreground">
                    {entry.professionalName ?? "Sem profissional"} ·{" "}
                    {ENTRY_TYPE_LABEL[entry.entry_type] ?? entry.entry_type} · chegou às{" "}
                    {formatTime(entry.arrived_at)}
                  </p>
                </div>

                <span
                  className={cn(
                    "shrink-0 text-[0.78rem] tabular-nums",
                    waitClass(entry.waitingMinutes)
                  )}
                >
                  {entry.waitingMinutes === 0 ? "agora" : `${entry.waitingMinutes} min`}
                </span>

                <div className="shrink-0">
                  <QueueStatusBadge status={entry.status} />
                </div>

                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  {entry.status === "waiting" && (
                    <Button
                      size="sm"
                      disabled={isPending}
                      onClick={() => run(() => callQueueEntryAction(entry.id))}
                    >
                      <PhoneCall className="size-3.5" /> Chamar
                    </Button>
                  )}
                  {(entry.status === "waiting" || entry.status === "called") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => run(() => cancelQueueEntryAction(entry.id))}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
