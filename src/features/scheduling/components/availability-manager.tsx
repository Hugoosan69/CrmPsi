"use client"

import { useActionState, useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { WEEKDAY_LABELS, type AvailabilityRule, type Room } from "@/config/agenda"
import {
  createAvailabilityAction,
  deleteAvailabilityAction,
  type AvailabilityActionState,
} from "../actions/availability.actions"
import { BackToBackField } from "./back-to-back-field"

type ProfessionalOption = { id: string; full_name: string }

const initialState: AvailabilityActionState = {}

/** "08:00:00" from Postgres, "08:00" in an <input type="time">. */
function toTimeInput(value: string) {
  return value.slice(0, 5)
}

function minutesBetween(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  return eh * 60 + em - (sh * 60 + sm)
}

function formatHours(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, "0")}`
}

export function AvailabilityManager({
  professionals,
  rooms,
  rules,
}: {
  professionals: ProfessionalOption[]
  rooms: Room[]
  rules: AvailabilityRule[]
}) {
  const [state, formAction, isPending] = useActionState(createAvailabilityAction, initialState)
  const [selectedProfessional, setSelectedProfessional] = useState(professionals[0]?.id ?? "")

  const roomById = new Map(rooms.map((r) => [r.id, r.name]))
  const visible = rules.filter((r) => r.professional_id === selectedProfessional)

  // Grouped by weekday so the shape of the week is readable at a glance, which a flat
  // list of rows never is.
  const byWeekday = WEEKDAY_LABELS.map((label, weekday) => ({
    label,
    weekday,
    rules: visible.filter((r) => r.weekday === weekday),
  }))

  const weeklyMinutes = visible.reduce(
    (sum, r) => sum + minutesBetween(toTimeInput(r.start_time), toTimeInput(r.end_time)),
    0
  )

  if (professionals.length === 0) {
    return (
      <EmptyState
        title="Nenhum profissional cadastrado"
        description="Cadastre um profissional antes de definir horários de atendimento."
      />
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[19rem_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-sm">Novo horário</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="grid gap-3.5">
            <input type="hidden" name="professional_id" value={selectedProfessional} />

            <div className="grid gap-1.5">
              <Label htmlFor="availability-weekday">Dia da semana</Label>
              <Select name="weekday" defaultValue="1">
                <SelectTrigger id="availability-weekday">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAY_LABELS.map((label, index) => (
                    <SelectItem key={label} value={String(index)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="availability-start">Início</Label>
                <Input id="availability-start" name="start_time" type="time" defaultValue="08:00" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="availability-end">Fim</Label>
                <Input id="availability-end" name="end_time" type="time" defaultValue="12:00" required />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="availability-slot">Intervalo entre encaixes</Label>
              <Select name="slot_minutes" defaultValue="30">
                <SelectTrigger id="availability-slot">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[15, 20, 30, 45, 50, 60].map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} minutos
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <BackToBackField id="availability-seguido" />

            <div className="grid gap-1.5">
              <Label htmlFor="availability-room">Sala (opcional)</Label>
              <Select name="room_id" defaultValue="">
                <SelectTrigger id="availability-room">
                  <SelectValue placeholder="Qualquer sala" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Qualquer sala</SelectItem>
                  {rooms
                    .filter((r) => r.active)
                    .map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {state.error ? (
              <p className="text-sm text-destructive" role="alert">
                {state.error}
              </p>
            ) : null}

            <Button type="submit" disabled={isPending || !selectedProfessional} className="mt-1">
              {isPending ? "Adicionando..." : "Adicionar horário"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-1.5 min-w-56">
            <Label htmlFor="availability-professional">Profissional</Label>
            <Select
              value={selectedProfessional}
              onValueChange={(value) => setSelectedProfessional(value ?? "")}
            >
              <SelectTrigger id="availability-professional">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {professionals.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            {visible.length === 0 ? (
              "Nenhum horário definido"
            ) : (
              <>
                <span className="metric font-medium text-foreground">{formatHours(weeklyMinutes)}</span>{" "}
                por semana em {visible.length} {visible.length === 1 ? "faixa" : "faixas"}
              </>
            )}
          </p>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title="Sem horário de atendimento"
            description="Enquanto este profissional não tiver horário definido, a agenda recusa qualquer agendamento para ele."
          />
        ) : (
          <div className="grid gap-2.5">
            {byWeekday.map((day) => (
              <div
                key={day.label}
                className="grid grid-cols-[7.5rem_1fr] items-start gap-4 rounded-lg border border-border bg-card px-4 py-3"
              >
                <p
                  className={
                    day.rules.length > 0
                      ? "text-sm font-medium"
                      : "text-sm text-muted-foreground"
                  }
                >
                  {day.label}
                </p>
                {day.rules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Não atende</p>
                ) : (
                  <div className="grid gap-2">
                    {day.rules.map((rule) => (
                      <RuleRow
                        key={rule.id}
                        rule={rule}
                        roomName={rule.room_id ? roomById.get(rule.room_id) ?? null : null}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RuleRow({ rule, roomName }: { rule: AvailabilityRule; roomName: string | null }) {
  const [isRemoving, startRemoving] = useTransition()

  const start = toTimeInput(rule.start_time)
  const end = toTimeInput(rule.end_time)

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="tabular-nums text-sm font-medium">
          {start} – {end}
        </span>
        <span className="text-xs text-muted-foreground">
          {rule.back_to_back
            ? "atendimento seguido"
            : `encaixes de ${rule.slot_minutes} min`}
          {roomName ? ` · ${roomName}` : ""}
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Remover horário de ${start} às ${end}`}
        disabled={isRemoving}
        onClick={() =>
          startRemoving(async () => {
            try {
              await deleteAvailabilityAction(rule.id)
              toast.success("Horário removido.")
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Não foi possível remover o horário.")
            }
          })
        }
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}
