import Link from "next/link"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import type { OccupancyRow } from "@/services/availability.service"

type ProfessionalOption = { id: string; full_name: string }

function formatHours(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, "0")}`
}

/**
 * Occupancy is only meaningful next to other professionals and against the 100% mark, so
 * it is a comparative bar list rather than another metric card — a lone "62%" tells the
 * owner nothing about where the idle capacity actually is.
 *
 * Bars are drawn against the busiest professional's *available* hours, so bar length
 * carries absolute capacity while the fill carries utilisation. Rows with no configured
 * availability are shown explicitly instead of as 0%, because "not set up" and "nobody
 * booked" are different problems with different fixes.
 */
export function OccupancyPanel({
  rows,
  professionals,
  periodLabel,
}: {
  rows: OccupancyRow[]
  professionals: ProfessionalOption[]
  periodLabel: string
}) {
  const nameById = new Map(professionals.map((p) => [p.id, p.full_name]))
  const maxAvailable = Math.max(...rows.map((r) => r.availableMinutes), 1)

  const configured = rows.filter((r) => r.rate !== null)
  const unconfigured = rows.filter((r) => r.rate === null)

  const totalAvailable = configured.reduce((s, r) => s + r.availableMinutes, 0)
  const totalBooked = configured.reduce((s, r) => s + r.bookedMinutes, 0)
  const clinicRate = totalAvailable > 0 ? totalBooked / totalAvailable : null

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Nenhum profissional ativo"
        description="Cadastre profissionais para acompanhar a ocupação da agenda."
      />
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="font-heading text-[0.95rem] font-semibold">Ocupação da agenda</h2>
          <p className="mt-0.5 text-[0.78rem] text-muted-foreground">{periodLabel}</p>
        </div>
        {clinicRate !== null && (
          <p className="text-[0.78rem] text-muted-foreground">
            <span className="metric text-base font-semibold text-foreground">
              {Math.round(clinicRate * 100)}%
            </span>{" "}
            na clínica · {formatHours(totalBooked)} de {formatHours(totalAvailable)}
          </p>
        )}
      </div>

      {configured.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-border px-4 py-6 text-center">
          <p className="text-sm font-medium">Nenhum horário de atendimento definido</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Sem horário cadastrado a agenda recusa qualquer agendamento, e não há como medir
            ocupação.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            render={<Link href="/gestao/agenda">Definir horários</Link>}
          />
        </div>
      ) : (
        <ul className="mt-5 grid gap-3.5">
          {configured
            .slice()
            .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))
            .map((row) => {
              const rate = row.rate ?? 0
              const widthPct = (row.availableMinutes / maxAvailable) * 100
              const fillPct = Math.min(rate, 1) * 100
              const over = rate > 1

              return (
                <li key={row.professionalId} className="grid gap-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium">
                      {nameById.get(row.professionalId) ?? "—"}
                    </span>
                    <span className="shrink-0 text-[0.78rem] text-muted-foreground tabular-nums">
                      <span
                        className={
                          over
                            ? "metric font-semibold text-status-warning"
                            : "metric font-semibold text-foreground"
                        }
                      >
                        {Math.round(rate * 100)}%
                      </span>{" "}
                      · {formatHours(row.bookedMinutes)} de {formatHours(row.availableMinutes)}
                    </span>
                  </div>
                  <div
                    className="h-2 rounded-full bg-muted"
                    style={{ width: `${Math.max(widthPct, 12)}%` }}
                    role="img"
                    aria-label={`${nameById.get(row.professionalId) ?? "Profissional"}: ${Math.round(
                      rate * 100
                    )}% de ocupação, ${formatHours(row.bookedMinutes)} agendados de ${formatHours(
                      row.availableMinutes
                    )} disponíveis`}
                  >
                    <div
                      className={
                        over
                          ? "h-full rounded-full bg-status-warning"
                          : "h-full rounded-full bg-chart-2"
                      }
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>
                </li>
              )
            })}
        </ul>
      )}

      {unconfigured.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-[0.78rem] text-muted-foreground">
            Sem horário definido:{" "}
            <span className="text-foreground">
              {unconfigured.map((r) => nameById.get(r.professionalId) ?? "—").join(", ")}
            </span>
            .{" "}
            <Link href="/gestao/agenda" className="underline underline-offset-2 hover:text-foreground">
              Configurar
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}
