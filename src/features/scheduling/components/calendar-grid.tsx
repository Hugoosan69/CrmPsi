"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"
import type { StatusTone } from "@/components/shared/status-dot"
import { minutesToTime } from "@/utils/datetime"

/**
 * One time grid, two consumers: the week view (a column per day, one professional) and
 * the resource view (a column per professional, one day). Keeping the layout maths in a
 * single place is what stops the two from drifting apart visually.
 *
 * The vertical window is derived from the clinic's configured availability rather than a
 * fixed 00:00–24:00, so the grid shows the working day and idle capacity is legible
 * instead of being lost in fourteen empty hours.
 */

/**
 * Altura da grade. A 1.05 px/min uma consulta de 30 minutos ocupava ~31px — cabia só o
 * nome do paciente, e os limiares abaixo escondiam procedimento e situação justamente nos
 * blocos mais comuns. A 1.8 os mesmos 30 minutos viram 54px, o suficiente para as três
 * linhas do bloco, e o dia inteiro continua rolando normalmente.
 */
const PX_PER_MINUTE = 1.8
const HOUR_HEIGHT = 60 * PX_PER_MINUTE

export type CalendarColumn = {
  key: string
  label: string
  sublabel?: string
  isToday?: boolean
}

export type CalendarEvent = {
  id: string
  columnKey: string
  startMinutes: number
  endMinutes: number
  title: string
  subtitle?: string | null
  statusLabel: string
  tone: StatusTone
  /** Cor definida pela clínica para esta situação (hex). Quando vem, substitui o `tone` —
   *  ver Configurações › Cores da agenda. O `tone` continua sendo o fallback, e é o que
   *  vale para quem nunca personalizou nada. */
  color?: string
  href?: string
  /** Cancelled and no-show slots read as vacated, not as occupied time. */
  muted?: boolean
}

export type CalendarBand = {
  columnKey: string
  startMinutes: number
  endMinutes: number
  kind: "available" | "blocked"
  label?: string
}

const TONE_BLOCK: Record<StatusTone, string> = {
  neutral: "border-status-neutral/45 bg-status-neutral/12 text-foreground",
  info: "border-status-info/45 bg-status-info/12 text-foreground",
  warning: "border-status-warning/50 bg-status-warning/14 text-foreground",
  success: "border-status-success/45 bg-status-success/12 text-foreground",
  danger: "border-status-danger/45 bg-status-danger/12 text-foreground",
}

const TONE_SPINE: Record<StatusTone, string> = {
  neutral: "bg-status-neutral",
  info: "bg-status-info",
  warning: "bg-status-warning",
  success: "bg-status-success",
  danger: "bg-status-danger",
}

/** Side-by-side placement for events that overlap in the same column. */
function withLanes(events: CalendarEvent[]) {
  const sorted = [...events].sort(
    (a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes
  )
  const laneEnds: number[] = []
  const placed = sorted.map((event) => {
    let lane = laneEnds.findIndex((end) => end <= event.startMinutes)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(event.endMinutes)
    } else {
      laneEnds[lane] = event.endMinutes
    }
    return { event, lane }
  })

  // A cluster shares the same lane count so blocks line up rather than each event
  // guessing its own width.
  const clusters: { items: typeof placed; lanes: number }[] = []
  for (const item of placed) {
    const current = clusters[clusters.length - 1]
    const overlapsCurrent =
      current && current.items.some((i) => i.event.endMinutes > item.event.startMinutes)
    if (overlapsCurrent) {
      current.items.push(item)
      current.lanes = Math.max(current.lanes, item.lane + 1)
    } else {
      clusters.push({ items: [item], lanes: item.lane + 1 })
    }
  }

  return clusters.flatMap((cluster) =>
    cluster.items.map(({ event, lane }) => ({ event, lane, lanes: cluster.lanes }))
  )
}

export function CalendarGrid({
  columns,
  events,
  bands = [],
  windowStart,
  windowEnd,
  emptyHint,
  onEventSelect,
}: {
  columns: CalendarColumn[]
  events: CalendarEvent[]
  bands?: CalendarBand[]
  /** Minutes since midnight. */
  windowStart: number
  windowEnd: number
  emptyHint?: string
  /** When given, blocks become buttons that open the caller's detail modal. */
  onEventSelect?: (eventId: string) => void
}) {
  const [nowMinutes, setNowMinutes] = useState<number | null>(null)

  // Computed after mount only — rendering it during SSR would hydrate against a
  // different clock.
  useEffect(() => {
    const read = () => {
      const parts = new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "America/Sao_Paulo",
      }).format(new Date())
      const [h, m] = parts.split(":").map(Number)
      setNowMinutes(h * 60 + m)
    }
    read()
    const timer = setInterval(read, 60_000)
    return () => clearInterval(timer)
  }, [])

  const firstHour = Math.floor(windowStart / 60)
  const lastHour = Math.ceil(windowEnd / 60)
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i)
  const totalMinutes = (lastHour - firstHour) * 60
  const gridHeight = totalMinutes * PX_PER_MINUTE

  const offset = (minutes: number) => (minutes - firstHour * 60) * PX_PER_MINUTE

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <div
        className="grid min-w-fit"
        style={{ gridTemplateColumns: `3.5rem repeat(${columns.length}, minmax(11.5rem, 1fr))` }}
      >
        {/* Header row */}
        <div className="sticky left-0 z-20 border-b border-r border-border bg-card" />
        {columns.map((column) => (
          <div
            key={column.key}
            className={cn(
              "border-b border-border px-3 py-2.5 text-center",
              column.isToday && "bg-accent/40"
            )}
          >
            <p className={cn("text-[0.82rem] font-medium", column.isToday && "text-accent-foreground")}>
              {column.label}
            </p>
            {column.sublabel && (
              <p className="mt-0.5 text-[0.72rem] text-muted-foreground">{column.sublabel}</p>
            )}
          </div>
        ))}

        {/* Time gutter */}
        <div className="sticky left-0 z-20 border-r border-border bg-card" style={{ height: gridHeight }}>
          {hours.map((hour, index) => (
            <div
              key={hour}
              className="relative border-border text-right"
              style={{ height: HOUR_HEIGHT }}
            >
              {index > 0 && (
                <span className="absolute -top-2 right-2 text-[0.68rem] text-muted-foreground tabular-nums">
                  {minutesToTime(hour * 60)}
                </span>
              )}
              {index === 0 && (
                <span className="absolute top-1 right-2 text-[0.68rem] text-muted-foreground tabular-nums">
                  {minutesToTime(hour * 60)}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Columns */}
        {columns.map((column) => {
          const columnEvents = withLanes(events.filter((e) => e.columnKey === column.key))
          const columnBands = bands.filter((b) => b.columnKey === column.key)

          return (
            <div
              key={column.key}
              className={cn(
                "relative border-r border-border last:border-r-0",
                column.isToday && "bg-accent/15"
              )}
              style={{ height: gridHeight }}
            >
              {/* Hour lines, e a meia hora tracejada: com a grade mais alta ela ajuda a
                  situar o horário de um bloco sem precisar contar do topo. */}
              {hours.map((hour, index) => (
                <div key={hour}>
                  <div
                    className={cn(
                      "absolute inset-x-0 border-t",
                      index === 0 ? "border-transparent" : "border-border"
                    )}
                    style={{ top: index * HOUR_HEIGHT }}
                  />
                  <div
                    className="absolute inset-x-0 border-t border-dashed border-border/45"
                    style={{ top: index * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                  />
                </div>
              ))}

              {/* Availability and blocks, behind the events */}
              {columnBands.map((band, index) => (
                <div
                  key={`${band.kind}-${index}`}
                  className={cn(
                    "absolute inset-x-0",
                    band.kind === "available"
                      ? "bg-background/70"
                      : "bg-status-warning/10 [background-image:repeating-linear-gradient(135deg,transparent_0_6px,color-mix(in_oklab,var(--status-warning)_22%,transparent)_6px_7px)]"
                  )}
                  style={{
                    top: offset(band.startMinutes),
                    height: Math.max((band.endMinutes - band.startMinutes) * PX_PER_MINUTE, 4),
                  }}
                  title={band.label}
                  aria-hidden
                />
              ))}

              {/* Now indicator */}
              {column.isToday &&
                nowMinutes !== null &&
                nowMinutes >= firstHour * 60 &&
                nowMinutes <= lastHour * 60 && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 border-t border-destructive"
                    style={{ top: offset(nowMinutes) }}
                    aria-hidden
                  >
                    <span className="absolute -top-[3px] -left-[3px] size-1.5 rounded-full bg-destructive" />
                  </div>
                )}

              {/* Events */}
              {columnEvents.map(({ event, lane, lanes }) => {
                const top = offset(event.startMinutes)
                const height = Math.max((event.endMinutes - event.startMinutes) * PX_PER_MINUTE, 22)
                const widthPct = 100 / lanes
                // Cor da clínica quando existe, tom do tema quando não. As mesmas
                // proporções (45% na borda, 12% no fundo) dos tons padrão, para uma cor
                // escolhida no seletor não virar um bloco chapado que apaga o texto.
                const custom = event.color
                const body = (
                  <div
                    className={cn(
                      "flex h-full gap-1.5 overflow-hidden rounded-md border px-1.5 py-1 text-left",
                      custom ? "text-foreground" : TONE_BLOCK[event.tone],
                      event.muted && "opacity-55",
                      event.href && "transition-shadow hover:shadow-card"
                    )}
                    style={
                      custom
                        ? {
                            borderColor: `color-mix(in oklab, ${custom} 45%, transparent)`,
                            backgroundColor: `color-mix(in oklab, ${custom} 12%, transparent)`,
                          }
                        : undefined
                    }
                  >
                    <span
                      className={cn(
                        "mt-0.5 w-0.5 shrink-0 rounded-full",
                        !custom && TONE_SPINE[event.tone]
                      )}
                      style={custom ? { backgroundColor: custom } : undefined}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[0.72rem] leading-tight font-medium">
                        <span className="tabular-nums">{minutesToTime(event.startMinutes)}</span>{" "}
                        {event.title}
                      </p>
                      {height > 34 && event.subtitle && (
                        <p className="truncate text-[0.68rem] leading-tight text-muted-foreground">
                          {event.subtitle}
                        </p>
                      )}
                      {height > 52 && (
                        <p className="truncate text-[0.66rem] leading-tight text-muted-foreground">
                          {event.statusLabel}
                        </p>
                      )}
                    </div>
                  </div>
                )

                const label = `${event.title}, ${minutesToTime(event.startMinutes)} às ${minutesToTime(
                  event.endMinutes
                )}, ${event.statusLabel}${event.subtitle ? `, ${event.subtitle}` : ""}`

                return (
                  <div
                    key={event.id}
                    className="absolute px-0.5"
                    style={{
                      top,
                      height,
                      left: `${lane * widthPct}%`,
                      width: `${widthPct}%`,
                    }}
                  >
                    {onEventSelect ? (
                      <button
                        type="button"
                        className="block h-full w-full text-left"
                        aria-label={label}
                        aria-haspopup="dialog"
                        onClick={() => onEventSelect(event.id)}
                      >
                        {body}
                      </button>
                    ) : event.href ? (
                      <Link href={event.href} className="block h-full" aria-label={label}>
                        {body}
                      </Link>
                    ) : (
                      <div
                        title={`${minutesToTime(event.startMinutes)}–${minutesToTime(event.endMinutes)} · ${
                          event.title
                        } · ${event.statusLabel}`}
                      >
                        {body}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {events.length === 0 && emptyHint && (
        <p className="border-t border-border px-4 py-3 text-center text-sm text-muted-foreground">
          {emptyHint}
        </p>
      )}
    </div>
  )
}

/**
 * The grid's vertical window: the union of the availability rules in view, padded to whole
 * hours, with a sane fallback for a clinic that has not configured availability yet.
 */
export function deriveWindow(
  spans: { startMinutes: number; endMinutes: number }[],
  fallback = { start: 7 * 60, end: 20 * 60 }
) {
  if (spans.length === 0) return { windowStart: fallback.start, windowEnd: fallback.end }

  const start = Math.min(...spans.map((s) => s.startMinutes))
  const end = Math.max(...spans.map((s) => s.endMinutes))

  return {
    windowStart: Math.max(0, Math.floor(start / 60) * 60),
    windowEnd: Math.min(24 * 60, Math.ceil(end / 60) * 60),
  }
}
