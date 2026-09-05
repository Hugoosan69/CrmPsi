"use client"

import { useState } from "react"

import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONES,
  DEFAULT_APPOINTMENT_STATUS_COLORS,
  isVacatedStatus,
  type AppointmentStatusColors,
  type AvailabilityRule,
  type ScheduleException,
} from "@/config/agenda"
import type { AppointmentView } from "@/services/scheduling.service"
import type { ProcedureOption, ProfessionalOption } from "@/types/options"
import {
  addDays,
  minutesSinceMidnight,
  timeToMinutes,
  toClinicDate,
} from "@/utils/datetime"
import {
  CalendarGrid,
  deriveWindow,
  type CalendarBand,
  type CalendarColumn,
  type CalendarEvent,
} from "./calendar-grid"
import { AppointmentDetailDialog } from "./appointment-detail-dialog"

/**
 * What the detail modal needs in order to act on a booking. Both calendars take the same
 * set, so clicking a block behaves identically in the week and the resource view.
 */
type ActionProps = {
  /** Every active professional — the reschedule form needs the full list, not just the
   *  columns currently on screen. */
  formProfessionals: ProfessionalOption[]
  procedures: ProcedureOption[]
  rooms?: { id: string; name: string }[]
  canManage: boolean
  canCheckIn: boolean
  /** Cores por situação definidas pela clínica (Configurações › Cores da agenda).
   *  Ausente = as cores padrão do tema. */
  statusColors?: AppointmentStatusColors
}

/**
 * Selection is held by id, not by the appointment object: a background refetch replaces the
 * array, and a captured copy would leave the modal showing pre-edit values.
 */
function useAppointmentSelection(appointments: AppointmentView[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = appointments.find((a) => a.id === selectedId) ?? null
  return { setSelectedId, selected }
}

function toEvent(
  appointment: AppointmentView,
  columnKey: string,
  subtitle: string | null,
  statusColors: AppointmentStatusColors = DEFAULT_APPOINTMENT_STATUS_COLORS
): CalendarEvent {
  const start = minutesSinceMidnight(appointment.scheduled_at)
  // Requisito 4: selo do pacote junto ao nome do paciente, direto no card da agenda —
  // "Última sessão" destaca quando é a 4/4 para a recepção já oferecer renovação.
  const title = appointment.packageSessionLabel
    ? `${appointment.patientName} — ${appointment.packageSessionLabel}${
        appointment.packageSessionIsLast ? " · última sessão" : ""
      }`
    : appointment.patientName
  return {
    id: appointment.id,
    columnKey,
    startMinutes: start,
    endMinutes: start + appointment.duration_minutes,
    title,
    subtitle,
    statusLabel: APPOINTMENT_STATUS_LABELS[appointment.status],
    tone: appointment.packageSessionIsLast ? "warning" : APPOINTMENT_STATUS_TONES[appointment.status],
    // A última sessão do pacote continua roubando a cor de aviso: é o card que a recepção
    // precisa enxergar para oferecer renovação, e isso vale mais que a cor da situação.
    color: appointment.packageSessionIsLast ? undefined : statusColors[appointment.status],
    muted: isVacatedStatus(appointment.status),
  }
}

/**
 * Clinic-local minute span of an exception on one calendar date, clamped to that date.
 * An exception spanning several days contributes a full-day band to each of them.
 */
function exceptionSpanOnDate(exception: ScheduleException, date: string) {
  const startDate = toClinicDate(exception.starts_at)
  const endDate = toClinicDate(exception.ends_at)
  if (date < startDate || date > endDate) return null

  return {
    startMinutes: date === startDate ? minutesSinceMidnight(exception.starts_at) : 0,
    endMinutes: date === endDate ? minutesSinceMidnight(exception.ends_at) : 24 * 60,
  }
}

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const

function weekdayOf(date: string) {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function dayNumber(date: string) {
  return Number(date.slice(8, 10))
}

/**
 * One professional across a week. This is the view that answers "how full is my week and
 * where are my gaps" — the availability band behind the events is what makes the gaps
 * readable as capacity rather than as blank space.
 */
export function WeekCalendar({
  weekStart,
  today,
  appointments,
  rules,
  exceptions,
  professionalId,
  formProfessionals,
  procedures,
  rooms = [],
  canManage,
  canCheckIn,
  statusColors,
}: {
  weekStart: string
  today: string
  appointments: AppointmentView[]
  rules: AvailabilityRule[]
  exceptions: ScheduleException[]
  /** `null` = semana da equipe inteira. */
  professionalId: string | null
} & ActionProps) {
  const { setSelectedId, selected } = useAppointmentSelection(appointments)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const equipe = professionalId === null

  const columns: CalendarColumn[] = days.map((date) => ({
    key: date,
    label: WEEKDAY_SHORT[weekdayOf(date)],
    sublabel: String(dayNumber(date)),
    isToday: date === today,
  }))

  const ownRules = rules.filter((r) => r.professional_id === professionalId && r.active)

  // Na visão de equipe as faixas de disponibilidade ficam de fora. Elas são de cada pessoa;
  // desenhar as de todo mundo sobrepostas na mesma coluna vira uma mancha que não informa
  // de quem é o quê. O que importa aqui são os agendamentos.
  const bands: CalendarBand[] = []
  for (const date of equipe ? [] : days) {
    const weekday = weekdayOf(date)
    for (const rule of ownRules) {
      if (rule.weekday !== weekday) continue
      bands.push({
        columnKey: date,
        startMinutes: timeToMinutes(rule.start_time),
        endMinutes: timeToMinutes(rule.end_time),
        kind: "available",
      })
    }
    for (const exception of exceptions) {
      if (exception.kind !== "block") continue
      if (exception.professional_id && exception.professional_id !== professionalId) continue
      const span = exceptionSpanOnDate(exception, date)
      if (!span) continue
      bands.push({
        columnKey: date,
        ...span,
        kind: "blocked",
        label: exception.reason ?? "Bloqueado",
      })
    }
  }

  const events = appointments.map((appointment) =>
    toEvent(
      appointment,
      toClinicDate(appointment.scheduled_at),
      // De quem é o horário passa a ser a informação que falta quando tudo está junto; o
      // procedimento continua visível ao abrir o agendamento.
      equipe ? appointment.professionalName : appointment.procedureName,
      statusColors
    )
  )

  const { windowStart, windowEnd } = deriveWindow([
    ...bands.map((b) => ({ startMinutes: b.startMinutes, endMinutes: b.endMinutes })),
    ...events.map((e) => ({ startMinutes: e.startMinutes, endMinutes: e.endMinutes })),
  ])

  return (
    <>
      <CalendarGrid
        columns={columns}
        events={events}
        bands={bands}
        windowStart={windowStart}
        windowEnd={windowEnd}
        onEventSelect={setSelectedId}
        emptyHint={
          equipe
            ? "Nenhum agendamento nesta semana."
            : ownRules.length === 0
              ? "Nenhum horário de atendimento cadastrado — a agenda recusa agendamentos até que a gestão defina os horários."
              : "Nenhum agendamento nesta semana."
        }
      />
      <AppointmentDetailDialog
        appointment={selected}
        professionals={formProfessionals}
        procedures={procedures}
        rooms={rooms}
        canManage={canManage}
        canCheckIn={canCheckIn}
        open={selected !== null}
        onOpenChange={(next) => {
          if (!next) setSelectedId(null)
        }}
      />
    </>
  )
}

/**
 * One day across every professional — the reception and management view. Columns are
 * resources, so an unstaffed morning or a professional carrying the whole day is visible
 * at a glance, which is exactly what a per-professional list cannot show.
 */
export function ResourceCalendar({
  date,
  today,
  professionals,
  appointments,
  rules,
  exceptions,
  formProfessionals,
  procedures,
  rooms = [],
  canManage,
  canCheckIn,
  statusColors,
}: {
  date: string
  today: string
  professionals: ProfessionalOption[]
  appointments: AppointmentView[]
  rules: AvailabilityRule[]
  exceptions: ScheduleException[]
} & ActionProps) {
  const { setSelectedId, selected } = useAppointmentSelection(appointments)
  const weekday = weekdayOf(date)
  const isToday = date === today

  const columns: CalendarColumn[] = professionals.map((professional) => {
    const count = appointments.filter(
      (a) => a.professional_id === professional.id && !isVacatedStatus(a.status)
    ).length
    return {
      key: professional.id,
      label: professional.full_name,
      sublabel: count === 0 ? "livre" : `${count} ${count === 1 ? "consulta" : "consultas"}`,
      isToday,
    }
  })

  const bands: CalendarBand[] = []
  for (const professional of professionals) {
    for (const rule of rules) {
      if (rule.professional_id !== professional.id || !rule.active) continue
      if (rule.weekday !== weekday) continue
      bands.push({
        columnKey: professional.id,
        startMinutes: timeToMinutes(rule.start_time),
        endMinutes: timeToMinutes(rule.end_time),
        kind: "available",
      })
    }
    for (const exception of exceptions) {
      if (exception.kind !== "block") continue
      if (exception.professional_id && exception.professional_id !== professional.id) continue
      const span = exceptionSpanOnDate(exception, date)
      if (!span) continue
      bands.push({
        columnKey: professional.id,
        ...span,
        kind: "blocked",
        label: exception.reason ?? "Bloqueado",
      })
    }
  }

  const events = appointments.map((appointment) =>
    toEvent(appointment, appointment.professional_id, appointment.procedureName, statusColors)
  )

  const { windowStart, windowEnd } = deriveWindow([
    ...bands.map((b) => ({ startMinutes: b.startMinutes, endMinutes: b.endMinutes })),
    ...events.map((e) => ({ startMinutes: e.startMinutes, endMinutes: e.endMinutes })),
  ])

  if (professionals.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        Nenhum profissional ativo para montar a agenda.
      </p>
    )
  }

  return (
    <>
      <CalendarGrid
        columns={columns}
        events={events}
        bands={bands}
        windowStart={windowStart}
        windowEnd={windowEnd}
        onEventSelect={setSelectedId}
        emptyHint="Nenhum agendamento neste dia."
      />
      <AppointmentDetailDialog
        appointment={selected}
        professionals={formProfessionals}
        procedures={procedures}
        rooms={rooms}
        canManage={canManage}
        canCheckIn={canCheckIn}
        open={selected !== null}
        onOpenChange={(next) => {
          if (!next) setSelectedId(null)
        }}
      />
    </>
  )
}
