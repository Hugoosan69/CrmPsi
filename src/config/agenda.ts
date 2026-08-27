import type { AppointmentStatus, Database, SlotProblem } from "@/types/supabase"
import type { StatusTone } from "@/components/shared/status-dot"

/**
 * Agenda vocabulary shared by server and client. Deliberately free of `server-only` and
 * of any Supabase client import: the availability manager and the room/block panels are
 * Client Components, and pulling these from services/availability.service.ts would drag
 * a server-only module into the browser bundle.
 */

/** 0 = Sunday, matching Postgres `extract(dow ...)` and `Date.getDay()`. */
export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const

/**
 * Why a slot cannot be booked, in the clinic's own language. The codes come from the
 * `appointment_slot_problem` SQL function (database/migrations/002); keeping the copy in
 * one place means the same rule produces the same explanation wherever it is enforced.
 */
const SLOT_PROBLEM_MESSAGES: Record<SlotProblem, string> = {
  invalid_duration: "A duração precisa ser maior que zero.",
  crosses_midnight: "Um agendamento não pode atravessar a meia-noite. Divida em dois.",
  outside_availability:
    "O profissional não atende neste horário. Ajuste os horários dele em Gestão › Configuração da agenda, ou registre um plantão extra.",
  blocked: "Este horário está bloqueado (férias, feriado ou bloqueio pontual).",
  professional_busy: "O profissional já tem outro agendamento que se sobrepõe a este horário.",
  room_busy: "A sala já está ocupada neste horário.",
}

export function describeSlotProblem(problem: SlotProblem | null | undefined) {
  if (!problem) return null
  return SLOT_PROBLEM_MESSAGES[problem] ?? "Este horário não está disponível."
}

export type Room = Database["public"]["Tables"]["rooms"]["Row"]
export type AvailabilityRule = Database["public"]["Tables"]["professional_availability"]["Row"]
export type ScheduleException = Database["public"]["Tables"]["schedule_exceptions"]["Row"]

export const ROOM_KINDS = [
  { value: "consultorio", label: "Consultório" },
  { value: "sala_exame", label: "Sala de exame" },
  { value: "sala_procedimento", label: "Sala de procedimento" },
  { value: "sala_grupo", label: "Sala de grupo" },
] as const

export function roomKindLabel(value: string) {
  return ROOM_KINDS.find((k) => k.value === value)?.label ?? value
}

/**
 * Appointment status vocabulary, shared by the badge (Server Component) and the calendar
 * (Client Component). Item 20: colour never travels without its label.
 */
export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
  completed: "Concluído",
}

export const APPOINTMENT_STATUS_TONES: Record<AppointmentStatus, StatusTone> = {
  scheduled: "neutral",
  confirmed: "info",
  cancelled: "danger",
  no_show: "warning",
  completed: "success",
}

/** A cancelled or missed slot is vacated time — it should not read as occupied. */
export function isVacatedStatus(status: AppointmentStatus) {
  return status === "cancelled" || status === "no_show"
}

/** Which calendar an agenda screen is showing. */
export type AgendaView = "lista" | "dia" | "semana"

/**
 * Narrows an arbitrary `?vista=` value to a view the screen actually offers.
 *
 * Lives here rather than beside the view switcher because the switcher is a Client
 * Component: every export of a `"use client"` module becomes a client reference, so a
 * Server Component page cannot call a plain function from it.
 */
export function parseView(raw: string | undefined, allowed: AgendaView[]): AgendaView {
  if (raw && (allowed as string[]).includes(raw)) return raw as AgendaView
  return allowed[0]
}
