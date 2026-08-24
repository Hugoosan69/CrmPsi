"use client"

import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Pause, Play } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  getTimerSnapshotAction,
  pauseServiceAction,
  resumeServiceAction,
} from "../actions/service.actions"

function formatHMS(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":")
}

/**
 * Item 8.6/8.7: the timer is the anchor of the workspace, not something tucked into a
 * tab. A dark panel against the light chrome makes it the one thing the professional's
 * eye lands on, and the digits are large enough to read from across the room.
 *
 * Correctness (item 8.6): the DB event log is the source of truth. We re-sync every 5s
 * and only interpolate between syncs, so a refresh, a new tab, or coming back tomorrow
 * all recompute from stored timestamps rather than from browser memory.
 */
export function ServiceTimerPanel({ queueEntryId }: { queueEntryId: string }) {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ["timer", queueEntryId],
    queryFn: () => getTimerSnapshotAction(queueEntryId),
    refetchInterval: 5000,
  })
  const [displaySeconds, setDisplaySeconds] = useState(0)
  const [isToggling, setIsToggling] = useState(false)

  useEffect(() => {
    if (!data?.hasSession) return

    const syncedAt = Date.now()
    const base = data.elapsedSeconds
    const running = data.isRunning

    const tick = () => {
      setDisplaySeconds(running ? base + Math.floor((Date.now() - syncedAt) / 1000) : base)
    }

    const immediate = setTimeout(tick, 0)
    const interval = running ? setInterval(tick, 1000) : undefined
    return () => {
      clearTimeout(immediate)
      if (interval) clearInterval(interval)
    }
  }, [data])

  if (!data?.hasSession) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-5 text-center">
        <p className="text-[0.68rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          Tempo de atendimento
        </p>
        <p className="metric mt-2 font-mono text-[1.9rem] leading-none text-muted-foreground/50">
          00:00:00
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          O cronômetro inicia quando você começar o atendimento pela fila.
        </p>
      </div>
    )
  }

  const running = data.isRunning && !data.finished
  const paused = !data.isRunning && !data.finished

  async function toggle() {
    setIsToggling(true)
    try {
      if (running) await pauseServiceAction(queueEntryId)
      else await resumeServiceAction(queueEntryId)
      await queryClient.invalidateQueries({ queryKey: ["timer", queueEntryId] })
      await queryClient.invalidateQueries({ queryKey: ["queue"] })
    } finally {
      setIsToggling(false)
    }
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl px-5 py-6 text-center shadow-card",
        // Deep petrol slab — the single dark surface in a light interface, so it reads
        // as the instrument panel of the screen.
        "bg-[#0B2434] text-white"
      )}
    >
      {/* Soft glow keyed to state: alive while running, amber while paused. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage: running
            ? "radial-gradient(70% 60% at 50% 0%, rgba(79,163,188,0.30), transparent 70%)"
            : paused
              ? "radial-gradient(70% 60% at 50% 0%, rgba(210,162,76,0.24), transparent 70%)"
              : "none",
        }}
        aria-hidden
      />

      <div className="relative">
        <p className="flex items-center justify-center gap-2 text-[0.66rem] font-semibold tracking-[0.12em] text-white/55 uppercase">
          <span
            className={cn(
              "inline-flex size-1.5 rounded-full",
              running ? "animate-pulse bg-status-success" : paused ? "bg-status-warning" : "bg-white/40"
            )}
            aria-hidden
          />
          {data.finished ? "Atendimento finalizado" : paused ? "Pausado" : "Tempo de atendimento"}
        </p>

        <p
          className="metric mt-2.5 font-mono text-[2.35rem] leading-none font-semibold tabular-nums"
          role="timer"
          aria-label={`Tempo de atendimento: ${formatHMS(displaySeconds)}`}
        >
          {formatHMS(displaySeconds)}
        </p>

        {!data.finished && (
          <button
            type="button"
            onClick={toggle}
            disabled={isToggling}
            className={cn(
              "mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[0.8rem] font-medium transition-colors",
              "bg-white/10 text-white hover:bg-white/18 disabled:opacity-50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            )}
          >
            {running ? (
              <>
                <Pause className="size-3.5" /> Pausar
              </>
            ) : (
              <>
                <Play className="size-3.5" /> Retomar
              </>
            )}
          </button>
        )}

        {paused && (
          <p className="mt-3 text-[0.72rem] text-white/50">
            O tempo pausado não conta como atendimento efetivo.
          </p>
        )}
      </div>
    </div>
  )
}
