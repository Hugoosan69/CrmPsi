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
  triagem: "Triagem",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
  completed: "Concluído",
}

export const APPOINTMENT_STATUS_TONES: Record<AppointmentStatus, StatusTone> = {
  scheduled: "neutral",
  // Sem tom próprio no tema — a triagem nasceu junto com as cores configuráveis
  // (migrations/021-022) e o que a distingue no card é a cor padrão abaixo.
  triagem: "info",
  confirmed: "info",
  cancelled: "danger",
  no_show: "warning",
  completed: "success",
}

/**
 * Cor de cada situação no card da agenda.
 *
 * Os padrões abaixo são os mesmos tons que a agenda sempre usou (as variáveis
 * `--status-*` do tema), escritos em hexadecimal porque agora atravessam o banco: a clínica
 * pode trocar qualquer um deles em Configurações › Cores da agenda. Quem olha a grade de
 * longe reconhece o dia pela cor antes de ler qualquer texto, e essa leitura é particular
 * de cada clínica — a que atende muita triagem quer "agendado" gritando, a que vive de
 * retorno quer "confirmado".
 *
 * A cor **nunca** viaja sozinha: o rótulo continua no card e no `aria-label`, senão a
 * agenda deixa de funcionar para quem não distingue as cores.
 */
export const DEFAULT_APPOINTMENT_STATUS_COLORS: Record<AppointmentStatus, string> = {
  scheduled: "#8494A0",
  triagem: "#7A5C9E",
  confirmed: "#1B7F94",
  cancelled: "#C33C2E",
  no_show: "#B07C1F",
  completed: "#2F8461",
}

export type AppointmentStatusColors = Record<AppointmentStatus, string>

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

/** `#RGB` e `#RRGGBB` entram; qualquer outra coisa (inclusive `red` ou uma função CSS)
 *  fica de fora — o valor vai para dentro de um `style`, e um campo de configuração não é
 *  lugar de aceitar string arbitrária. */
export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (HEX_COLOR.test(trimmed)) return trimmed.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return null
}

/** Completa o que estiver faltando (ou inválido) com o padrão, para a tela nunca ficar
 *  sem cor por causa de um valor mal gravado. */
export function resolveStatusColors(stored: unknown): AppointmentStatusColors {
  const raw = (stored ?? {}) as Record<string, unknown>
  const result = { ...DEFAULT_APPOINTMENT_STATUS_COLORS }
  for (const status of Object.keys(result) as AppointmentStatus[]) {
    const color = normalizeHexColor(raw[status])
    if (color) result[status] = color
  }
  return result
}

/**
 * Situações que ocupam o horário e ainda esperam um desfecho.
 *
 * É o mesmo conjunto dos guardas de conflito no banco (migrations/023): mudar um lado sem
 * o outro é como a triagem nasceria furada — visível na agenda, invisível para quem checa
 * se o horário está livre. Cancelado e não-compareceu ficam de fora porque de fato
 * liberam o horário; concluído porque já teve desfecho.
 */
export const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "scheduled",
  "triagem",
  "confirmed",
]

/** A cancelled or missed slot is vacated time — it should not read as occupied. */
export function isVacatedStatus(status: AppointmentStatus) {
  return status === "cancelled" || status === "no_show"
}

/** Which calendar an agenda screen is showing. */
// "horarios" não é uma visualização do calendário e sim a configuração dos próprios
// dias de atendimento — fica no mesmo seletor porque é onde o profissional procura.
export type AgendaView = "lista" | "dia" | "semana" | "horarios"

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
