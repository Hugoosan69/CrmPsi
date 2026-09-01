"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CalendarDays, Clock, Columns3, List } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { addDays, startOfWeek, todaySaoPauloDate } from "@/utils/datetime"
import type { AgendaView } from "@/config/agenda"

const VIEW_META: Record<AgendaView, { label: string; icon: typeof List }> = {
  lista: { label: "Lista", icon: List },
  dia: { label: "Dia", icon: Columns3 },
  semana: { label: "Semana", icon: CalendarDays },
  horarios: { label: "Meus horários", icon: Clock },
}

/**
 * View, date and (in week mode) professional all live in the URL, so a particular agenda
 * screen is linkable and survives a refresh — a receptionist sending "look at Thursday"
 * to a colleague is a real workflow.
 */
/**
 * Valor do seletor que significa "sem filtrar por profissional".
 *
 * A ausência do parâmetro `profissional` na URL é o que representa a equipe — assim o
 * endereço limpo já cai na visão de todos, e não num profissional escolhido por acaso.
 */
export const TODA_EQUIPE = "equipe"

export function AgendaViewNav({
  view,
  date,
  views,
  professionals,
  selectedProfessionalId,
}: {
  view: AgendaView
  date: string
  views: AgendaView[]
  /** Quando informado, a vista ganha o seletor de profissional (com a opção de equipe). */
  professionals?: { id: string; full_name: string }[]
  /** `null` = equipe inteira. */
  selectedProfessionalId?: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function push(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams)
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v)
      else params.delete(k)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  const step = view === "semana" ? 7 : 1
  const periodLabel =
    view === "semana"
      ? `Semana de ${formatShort(startOfWeek(date))} a ${formatShort(addDays(startOfWeek(date), 6))}`
      : null

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label={view === "semana" ? "Semana anterior" : "Dia anterior"}
            onClick={() => push({ data: addDays(date, -step) })}
          >
            ←
          </Button>
          <Button variant="outline" size="sm" onClick={() => push({ data: todaySaoPauloDate() })}>
            Hoje
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label={view === "semana" ? "Próxima semana" : "Próximo dia"}
            onClick={() => push({ data: addDays(date, step) })}
          >
            →
          </Button>
          <Input
            type="date"
            value={date}
            aria-label="Ir para a data"
            onChange={(e) => e.target.value && push({ data: e.target.value })}
            className="w-40"
          />
        </div>

        {/* Segmented view switcher — one control, current state visible without opening it. */}
        <div
          className="inline-flex rounded-lg border border-border bg-card p-0.5"
          role="group"
          aria-label="Modo de visualização"
        >
          {views.map((candidate) => {
            const { label, icon: Icon } = VIEW_META[candidate]
            const isActive = candidate === view
            return (
              <button
                key={candidate}
                type="button"
                aria-pressed={isActive}
                onClick={() => push({ vista: candidate })}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.8rem] font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {professionals && professionals.length > 0 && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid min-w-56 gap-1.5">
            <Label htmlFor="agenda-professional">Mostrando</Label>
            <Select
              value={selectedProfessionalId ?? TODA_EQUIPE}
              onValueChange={(value) =>
                value && push({ profissional: value === TODA_EQUIPE ? "" : value })
              }
            >
              <SelectTrigger id="agenda-professional">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODA_EQUIPE}>Toda a equipe</SelectItem>
                {professionals.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {periodLabel && <p className="text-sm text-muted-foreground">{periodLabel}</p>}
        </div>
      )}

      {!professionals && periodLabel && (
        <p className="text-sm text-muted-foreground">{periodLabel}</p>
      )}
    </div>
  )
}

function formatShort(date: string) {
  const [, month, day] = date.split("-")
  return `${day}/${month}`
}
