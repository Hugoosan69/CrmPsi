"use client"

import { useActionState, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  APPOINTMENT_STATUS_LABELS,
  DEFAULT_APPOINTMENT_STATUS_COLORS,
  type AppointmentStatusColors,
} from "@/config/agenda"
import type { AppointmentStatus } from "@/types/supabase"
import { saveAgendaColorsAction, type SettingsActionState } from "../actions/settings.actions"

const initialState: SettingsActionState = {}

const STATUS_ORDER: AppointmentStatus[] = [
  "scheduled",
  "triagem",
  "confirmed",
  "completed",
  "no_show",
  "cancelled",
]

/** O que cada situação significa na prática — a cor só ajuda quem sabe o que está pintando. */
const STATUS_HINTS: Record<AppointmentStatus, string> = {
  scheduled: "Marcado, ainda sem confirmação do paciente.",
  triagem: "Primeira avaliação, a porta de entrada do paciente.",
  confirmed: "Paciente confirmou que vem.",
  completed: "Atendimento realizado e encerrado.",
  no_show: "Paciente não compareceu.",
  cancelled: "Cancelado — o horário voltou a ficar livre.",
}

/**
 * Cores da agenda por situação.
 *
 * A prévia ao lado de cada campo é o próprio card da agenda em miniatura, com a mesma
 * mistura de fundo, borda e faixa lateral que a grade usa — escolher cor olhando um
 * quadradinho sólido engana: o que vai para a tela é a versão translúcida.
 */
export function AgendaColorsSettings({ colors }: { colors: AppointmentStatusColors }) {
  const [state, formAction, isPending] = useActionState(saveAgendaColorsAction, initialState)
  const [current, setCurrent] = useState<AppointmentStatusColors>(colors)

  function update(status: AppointmentStatus, value: string) {
    setCurrent((prev) => ({ ...prev, [status]: value }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Cores dos cards da agenda</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-5">
          <p className="text-[0.75rem] text-muted-foreground">
            A cor vale para os cards das visões Dia e Semana. O nome da situação continua
            escrito no card — a cor acelera a leitura, não a substitui.
          </p>

          <div className="grid gap-3">
            {STATUS_ORDER.map((status) => (
              <div
                key={status}
                className="grid items-center gap-3 sm:grid-cols-[1fr_auto_11rem]"
              >
                <div>
                  <Label htmlFor={`color-${status}`}>{APPOINTMENT_STATUS_LABELS[status]}</Label>
                  <p className="text-[0.72rem] text-muted-foreground">{STATUS_HINTS[status]}</p>
                </div>

                {/* Prévia: mesma receita de cor do card real (ver calendar-grid.tsx). */}
                <div
                  className="flex h-11 w-40 items-center gap-1.5 overflow-hidden rounded-md border px-1.5 py-1"
                  style={{
                    borderColor: `color-mix(in oklab, ${current[status]} 45%, transparent)`,
                    backgroundColor: `color-mix(in oklab, ${current[status]} 12%, transparent)`,
                  }}
                >
                  <span
                    className="h-full w-0.5 shrink-0 rounded-full"
                    style={{ backgroundColor: current[status] }}
                    aria-hidden
                  />
                  <span className="truncate text-[0.72rem] leading-tight font-medium">
                    09:00 Paciente
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    id={`color-${status}`}
                    name={status}
                    type="color"
                    className="h-9 w-14 p-1"
                    value={current[status]}
                    onChange={(event) => update(status, event.target.value)}
                  />
                  <span className="text-[0.72rem] text-muted-foreground tabular-nums">
                    {current[status]}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {state.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          {state.success && (
            <p className="text-sm text-status-success" role="status">
              {state.success}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar cores"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrent({ ...DEFAULT_APPOINTMENT_STATUS_COLORS })}
            >
              Restaurar padrão
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
