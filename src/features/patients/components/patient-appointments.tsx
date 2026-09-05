import { createClient } from "@/lib/supabase/server"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusDot } from "@/components/shared/status-dot"
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_TONES } from "@/config/agenda"
import { listAppointmentsForPatient } from "@/services/scheduling.service"
import { formatDateTime } from "@/utils/datetime"

/**
 * Os atendimentos do paciente: a agenda dele, não o prontuário.
 *
 * A aba mostrava só `medical_records`, então um paciente com consultas marcadas — e até
 * já realizadas fora do fluxo da fila — aparecia como "primeiro atendimento". Quem abre a
 * ficha quer ver o histórico de idas e vindas: quando, com quem, o que foi feito e em que
 * situação parou. O prontuário continua logo abaixo, para quem tem records.view.
 */
export async function PatientAppointments({
  clinicId,
  patientId,
}: {
  clinicId: string
  patientId: string
}) {
  const supabase = await createClient()
  const appointments = await listAppointmentsForPatient(supabase, clinicId, patientId)

  if (appointments.length === 0) {
    return (
      <EmptyState
        title="Nenhum atendimento"
        description="Este paciente ainda não tem consultas agendadas ou realizadas."
      />
    )
  }

  return (
    <ol className="grid gap-2">
      {appointments.map((appointment) => (
        <li
          key={appointment.id}
          className="rounded-xl border border-border bg-card p-3.5 shadow-soft"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-heading text-[0.9rem] font-semibold tabular-nums">
              {formatDateTime(appointment.scheduled_at)}
            </p>
            <StatusDot
              tone={APPOINTMENT_STATUS_TONES[appointment.status]}
              label={APPOINTMENT_STATUS_LABELS[appointment.status]}
            />
          </div>
          <p className="mt-1 text-[0.85rem] text-muted-foreground">
            {appointment.professionalName}
            {appointment.procedureName ? ` · ${appointment.procedureName}` : ""}
          </p>
          {appointment.packageSessionLabel && (
            <p
              className={
                appointment.packageSessionIsLast
                  ? "mt-1 text-xs font-medium text-amber-600"
                  : "mt-1 text-xs text-muted-foreground"
              }
            >
              {appointment.packageName ? `${appointment.packageName} · ` : ""}
              {appointment.packageSessionLabel}
              {appointment.packageSessionIsLast ? " · última sessão" : ""}
            </p>
          )}
          {appointment.cancelled_reason && (
            <p className="mt-1 text-xs text-muted-foreground">
              Motivo: {appointment.cancelled_reason}
            </p>
          )}
        </li>
      ))}
    </ol>
  )
}
