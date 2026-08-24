"use client"

import Link from "next/link"
import { useTransition } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowRight, Pause, Play, PhoneCall } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { cn } from "@/lib/utils"
import { formatTime } from "@/utils/datetime"
import {
  getQueueSnapshotAction,
  cancelQueueEntryAction,
  callQueueEntryAction,
} from "@/features/queue/actions/queue.actions"
import { QueueStatusBadge } from "@/features/queue/components/queue-status-badge"
import { TransferQueueEntryDialog } from "@/features/queue/components/transfer-queue-entry-dialog"
import {
  finishServiceAction,
  pauseServiceAction,
  resumeServiceAction,
  startServiceAction,
} from "../actions/service.actions"
import { ServiceTimer } from "./service-timer"
import type { ProfessionalOption } from "@/types/options"

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "")).toUpperCase()
}

/**
 * Item 10/11: an operational board, not a table — the patient being seen right now is
 * visually dominant, everyone else is a compact row, and every action a professional
 * needs is on the card itself (item 33: view → act, no navigating away).
 */
export function ProfessionalQueuePanel({
  professionalId,
  professionals,
}: {
  professionalId: string
  professionals: ProfessionalOption[]
}) {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ["queue", "profissional", professionalId],
    // `in_queue` band only: a professional must never see an unpaid patient.
    queryFn: () => getQueueSnapshotAction(professionalId, "in_queue"),
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
      <div className="grid gap-3">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm" role="alert">
        <p className="font-medium text-destructive">Não foi possível carregar a fila</p>
        <p className="mt-1 text-muted-foreground">{error.message}</p>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="Nenhum paciente na sua fila"
        description="Pacientes aparecem aqui depois que a recepção confirma o pagamento e libera para a fila."
      />
    )
  }

  const active = data.find((e) => e.status === "in_service" || e.status === "paused")
  const upcoming = data.filter((e) => e.id !== active?.id)

  return (
    <div className="grid gap-4">
      {active && (
        <div className="rounded-xl border border-primary/25 bg-card p-4 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
                {initials(active.patientName)}
              </div>
              <div className="min-w-0">
                <p className="font-heading text-[1.05rem] font-semibold">{active.patientName}</p>
                <p className="mt-0.5 truncate text-[0.8rem] text-muted-foreground">
                  {active.specialtyName ?? "Atendimento"} · chegou às {formatTime(active.arrived_at)}
                </p>
                <div className="mt-2">
                  <QueueStatusBadge status={active.status} />
                </div>
              </div>
            </div>
            <ServiceTimer queueEntryId={active.id} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3.5">
            <Button
              nativeButton={false} render={<Link href={`/profissional/atendimento/${active.id}`}>Abrir atendimento</Link>}
            />
            {active.status === "in_service" ? (
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => run(() => pauseServiceAction(active.id))}
              >
                <Pause className="size-4" /> Pausar
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => run(() => resumeServiceAction(active.id))}
              >
                <Play className="size-4" /> Retomar
              </Button>
            )}
            <TransferQueueEntryDialog
              queueEntryId={active.id}
              fromProfessionalId={professionalId}
              professionals={professionals}
            />
            <Button
              variant="destructive"
              className="ml-auto"
              disabled={isPending}
              onClick={() => run(() => finishServiceAction(active.id))}
            >
              Finalizar
            </Button>
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-[0.68rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
              Próximos ({upcoming.length})
            </p>
          </div>
          <ul className="divide-y divide-border/70">
            {upcoming.map((entry, index) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="w-5 shrink-0 text-center text-[0.78rem] font-medium tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.9rem] font-medium">{entry.patientName}</p>
                  <p className="truncate text-[0.75rem] text-muted-foreground">
                    {entry.specialtyName ? `${entry.specialtyName} · ` : ""}
                    chegou às {formatTime(entry.arrived_at)}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-[0.75rem] tabular-nums",
                    entry.waitingMinutes >= 20 ? "font-medium text-status-warning" : "text-muted-foreground"
                  )}
                >
                  {entry.waitingMinutes === 0 ? "agora" : `${entry.waitingMinutes} min`}
                </span>
                <div className="shrink-0">
                  <QueueStatusBadge status={entry.status} />
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  {entry.status === "waiting" && (
                    <>
                      <Button size="sm" disabled={isPending} onClick={() => run(() => callQueueEntryAction(entry.id))}>
                        <PhoneCall className="size-3.5" /> Chamar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => run(() => cancelQueueEntryAction(entry.id))}
                      >
                        Cancelar
                      </Button>
                    </>
                  )}
                  {entry.status === "called" && (
                    <Button size="sm" disabled={isPending} onClick={() => run(() => startServiceAction(entry.id))}>
                      Iniciar <ArrowRight className="size-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
