"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { cn } from "@/lib/utils"
import { getTimerSnapshotAction } from "../actions/service.actions"

function formatHMS(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":")
}

/**
 * Item 14: renders a running clock, but the source of truth is always the DB-timestamp
 * snapshot from getTimerSnapshotAction (re-synced every 5s) — the 1s interval here only
 * interpolates the display between syncs, it never invents time on its own. Every
 * setState call below runs inside a timer callback (never synchronously in the effect
 * body) so it stays outside React's render/effect purity checks.
 */
export function ServiceTimer({ queueEntryId }: { queueEntryId: string }) {
  const { data } = useQuery({
    queryKey: ["timer", queueEntryId],
    queryFn: () => getTimerSnapshotAction(queueEntryId),
    refetchInterval: 5000,
  })
  const [displaySeconds, setDisplaySeconds] = useState(0)

  useEffect(() => {
    if (!data?.hasSession) return

    const syncedAt = Date.now()
    const base = data.elapsedSeconds
    const isRunning = data.isRunning

    const tick = () => {
      setDisplaySeconds(isRunning ? base + Math.floor((Date.now() - syncedAt) / 1000) : base)
    }

    const immediate = setTimeout(tick, 0)
    const interval = isRunning ? setInterval(tick, 1000) : undefined

    return () => {
      clearTimeout(immediate)
      if (interval) clearInterval(interval)
    }
  }, [data])

  if (!data?.hasSession) return null

  const label = data.finished ? "Finalizado" : data.isRunning ? "Em atendimento" : "Pausado"
  const tone = data.finished
    ? { dot: "bg-status-neutral", text: "text-muted-foreground", chrome: "border-border bg-muted/40" }
    : data.isRunning
      ? { dot: "bg-status-success", text: "text-status-success", chrome: "border-status-success/25 bg-status-success/8" }
      : { dot: "bg-status-warning", text: "text-status-warning", chrome: "border-status-warning/30 bg-status-warning/10" }

  // Reads as an instrument rather than a stray number: enclosed chip, live dot,
  // tabular monospace digits so the width never jitters as seconds tick.
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 tabular-nums",
        tone.chrome
      )}
      role="timer"
      aria-label={`${label}: ${formatHMS(displaySeconds)}`}
    >
      <span className="relative flex size-2 shrink-0 items-center justify-center" aria-hidden>
        {data.isRunning && (
          <span className={cn("absolute inline-flex size-2 animate-ping rounded-full opacity-70", tone.dot)} />
        )}
        <span className={cn("relative inline-flex size-2 rounded-full", tone.dot)} />
      </span>
      <div className="leading-none">
        <span className={cn("block text-[0.62rem] font-semibold tracking-[0.08em] uppercase", tone.text)}>
          {label}
        </span>
        <span className="mt-1 block font-mono text-[1.15rem] leading-none font-medium tracking-tight">
          {formatHMS(displaySeconds)}
        </span>
      </div>
    </div>
  )
}
