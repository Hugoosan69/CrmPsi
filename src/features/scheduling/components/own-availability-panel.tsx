"use client"

import { useActionState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
import type { AvailabilityRule, Room } from "@/config/agenda"
import {
  createOwnAvailabilityAction,
  deleteOwnAvailabilityAction,
  type AvailabilityActionState,
} from "../actions/availability.actions"
import { SlotRhythmFields } from "./slot-rhythm-fields"

const initialState: AvailabilityActionState = {}

const WEEKDAYS = [
  { value: "1", label: "Segunda" },
  { value: "2", label: "Terça" },
  { value: "3", label: "Quarta" },
  { value: "4", label: "Quinta" },
  { value: "5", label: "Sexta" },
  { value: "6", label: "Sábado" },
  { value: "0", label: "Domingo" },
]

const WEEKDAY_LABEL: Record<number, string> = {
  0: "Domingo",
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
}

/** "08:00:00" -> "08:00" */
const hhmm = (t: string) => t.slice(0, 5)

/**
 * O profissional define os próprios dias e horários.
 *
 * Separado do painel da gestão de propósito: aquele deixa escolher de quem é o horário, e
 * quem entra por aqui só pode mexer no próprio — o alvo vem da sessão, nunca do formulário.
 * É também por isso que a permissão exigida é service.manage e não settings.manage: dizer
 * quando você trabalha não deveria vir junto com o poder de configurar salas, procedimentos
 * e os horários dos colegas.
 */
export function OwnAvailabilityPanel({
  rules,
  rooms,
}: {
  rules: AvailabilityRule[]
  rooms: Room[]
}) {
  const [state, formAction, isPending] = useActionState(createOwnAvailabilityAction, initialState)
  const [isDeleting, startDelete] = useTransition()

  const roomById = new Map(rooms.map((r) => [r.id, r.name]))
  const byWeekday = [...rules].sort(
    (a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)
  )

  return (
    <div className="grid gap-5">
      <p className="text-sm text-muted-foreground">
        Estes são os horários em que você atende. A agenda recusa agendamentos fora deles, e
        os blocos livres aparecem desenhados atrás dos seus compromissos.
      </p>

      <form
        action={formAction}
        className="grid items-start gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="own-weekday">Dia</Label>
          <Select name="weekday" defaultValue="1" required>
            <SelectTrigger id="own-weekday">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEKDAYS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="own-start">Início</Label>
          <Input id="own-start" name="start_time" type="time" defaultValue="08:00" required />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="own-end">Fim</Label>
          <Input id="own-end" name="end_time" type="time" defaultValue="12:00" required />
        </div>

        <SlotRhythmFields
          idPrefix="own"
          label="Duração da consulta"
          options={[15, 20, 30, 40, 45, 60]}
        />

        <div className="grid gap-1.5">
          <Label htmlFor="own-room">
            Sala <span className="text-muted-foreground">(opcional)</span>
          </Label>
          <Select name="room_id">
            <SelectTrigger id="own-room">
              <SelectValue placeholder="Sem sala fixa" />
            </SelectTrigger>
            <SelectContent>
              {rooms.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {state.error && (
          <p
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2 lg:col-span-5"
            role="alert"
          >
            {state.error}
          </p>
        )}

        <div className="sm:col-span-2 lg:col-span-5">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Adicionando..." : "Adicionar horário"}
          </Button>
        </div>
      </form>

      {byWeekday.length === 0 ? (
        <EmptyState
          title="Você ainda não definiu horários"
          description="Sem horários cadastrados a agenda recusa qualquer agendamento para você."
        />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {byWeekday.map((rule) => (
            <div
              key={rule.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {WEEKDAY_LABEL[rule.weekday]} · {hhmm(rule.start_time)} às{" "}
                  {hhmm(rule.end_time)}
                </p>
                <p className="text-[0.78rem] text-muted-foreground">
                  {rule.back_to_back
                    ? "Atendimento seguido, sem intervalo"
                    : `Consultas de ${rule.slot_minutes} min`}
                  {rule.room_id && roomById.has(rule.room_id)
                    ? ` · ${roomById.get(rule.room_id)}`
                    : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={isDeleting}
                aria-label={`Remover ${WEEKDAY_LABEL[rule.weekday]} ${hhmm(rule.start_time)}`}
                onClick={() =>
                  startDelete(async () => {
                    try {
                      await deleteOwnAvailabilityAction(rule.id)
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Não foi possível remover.")
                    }
                  })
                }
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
