import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { AppointmentStatus, Database } from "@/types/supabase"
import { dayRange, rangeBounds } from "@/utils/datetime"

type DB = SupabaseClient<Database>

export type AppointmentInput = {
  patient_id: string
  professional_id: string
  procedure_id?: string | null
  room_id?: string | null
  scheduled_at: string
  duration_minutes: number
  notes?: string | null
}

export async function listAppointmentsForDay(
  supabase: DB,
  clinicId: string,
  date: string,
  opts: { professionalId?: string } = {}
) {
  const { start, end } = dayRange(date)
  let query = supabase
    .from("appointments")
    .select("*")
    .eq("clinic_id", clinicId)
    .gte("scheduled_at", start)
    .lte("scheduled_at", end)
    .order("scheduled_at")

  if (opts.professionalId) query = query.eq("professional_id", opts.professionalId)

  const { data, error } = await query
  if (error) throw error
  return data
}

/**
 * Several clinic-local days at once, for the week and resource calendar views. Same
 * offset-explicit bounds as listAppointmentsForDay — a naive literal here would shift the
 * whole window three hours (see utils/datetime.ts).
 */
export async function listAppointmentsForRange(
  supabase: DB,
  clinicId: string,
  fromDate: string,
  toDate: string,
  opts: { professionalId?: string } = {}
) {
  const { start, end } = rangeBounds(fromDate, toDate)
  let query = supabase
    .from("appointments")
    .select("*")
    .eq("clinic_id", clinicId)
    .gte("scheduled_at", start)
    .lte("scheduled_at", end)
    .order("scheduled_at")

  if (opts.professionalId) query = query.eq("professional_id", opts.professionalId)

  const { data, error } = await query
  if (error) throw error
  return data
}

export type AppointmentView = Database["public"]["Tables"]["appointments"]["Row"] & {
  patientName: string
  professionalName: string
  procedureName: string | null
  /** "Pacote 3/4" quando o agendamento usa sessão de pacote, null quando é avulso. */
  packageSessionLabel: string | null
  /** Nome do pacote vendido, para o detalhe do agendamento. */
  packageName: string | null
  /** true quando a sessão reservada é a última do pacote — para destacar na agenda. */
  packageSessionIsLast: boolean
}

export async function hydrateAppointments(
  supabase: DB,
  appointments: Database["public"]["Tables"]["appointments"]["Row"][]
): Promise<AppointmentView[]> {
  if (appointments.length === 0) return []

  const patientIds = [...new Set(appointments.map((a) => a.patient_id))]
  const professionalIds = [...new Set(appointments.map((a) => a.professional_id))]
  const procedureIds = [...new Set(appointments.map((a) => a.procedure_id).filter(Boolean))] as string[]
  const packageSessionIds = [
    ...new Set(appointments.map((a) => a.patient_package_session_id).filter(Boolean)),
  ] as string[]

  const [{ data: patients }, { data: professionals }, { data: procedures }, { data: packageSessions }] =
    await Promise.all([
      supabase.from("patients").select("id, full_name, social_name").in("id", patientIds),
      supabase.from("professionals").select("id, full_name").in("id", professionalIds),
      procedureIds.length > 0
        ? supabase.from("procedures").select("id, name").in("id", procedureIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      packageSessionIds.length > 0
        ? supabase
            .from("patient_package_sessions")
            .select("id, session_number, patient_packages(total_sessions, session_packages(name))")
            .in("id", packageSessionIds)
        : Promise.resolve({
            data: [] as {
              id: string
              session_number: number
              patient_packages: { total_sessions: number; session_packages: { name: string } | null } | null
            }[],
          }),
    ])

  const patientById = new Map((patients ?? []).map((p) => [p.id, p]))
  const professionalById = new Map((professionals ?? []).map((p) => [p.id, p.full_name]))
  const procedureById = new Map((procedures ?? []).map((p) => [p.id, p.name]))
  const packageSessionById = new Map((packageSessions ?? []).map((s) => [s.id, s]))

  return appointments.map((appointment) => {
    const patient = patientById.get(appointment.patient_id)
    const packageSession = appointment.patient_package_session_id
      ? packageSessionById.get(appointment.patient_package_session_id)
      : undefined
    const total = packageSession?.patient_packages?.total_sessions ?? null
    return {
      ...appointment,
      patientName: patient?.social_name || patient?.full_name || "—",
      professionalName: professionalById.get(appointment.professional_id) ?? "—",
      procedureName: appointment.procedure_id ? procedureById.get(appointment.procedure_id) ?? null : null,
      packageSessionLabel:
        packageSession && total ? `Pacote ${packageSession.session_number}/${total}` : null,
      packageName: packageSession?.patient_packages?.session_packages?.name ?? null,
      packageSessionIsLast: !!(packageSession && total && packageSession.session_number === total),
    }
  })
}

/** Todos os agendamentos de um paciente, do mais recente para o mais antigo — é o
 * histórico que a ficha mostra na aba "Atendimentos". */
export async function listAppointmentsForPatient(
  supabase: DB,
  clinicId: string,
  patientId: string
): Promise<AppointmentView[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .order("scheduled_at", { ascending: false })
  if (error) throw error
  return hydrateAppointments(supabase, data ?? [])
}

/**
 * Agendamentos cujo horário já passou e que ninguém fechou — continuam "agendado" ou
 * "confirmado" sem virar concluído nem falta.
 *
 * Sem isto a agenda acumula silenciosamente consultas eternamente "confirmadas": a
 * clínica que atende sem passar pela fila nunca chega ao `completed`, e aí não se sabe o
 * que aconteceu de verdade, nem o pacote do paciente é debitado.
 */
export async function listPendingClosures(
  supabase: DB,
  clinicId: string,
  opts: { professionalId?: string; limit?: number } = {}
): Promise<AppointmentView[]> {
  let query = supabase
    .from("appointments")
    .select("*")
    .eq("clinic_id", clinicId)
    .in("status", ["scheduled", "confirmed"])
    .lt("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: false })
    .limit(opts.limit ?? 50)

  if (opts.professionalId) query = query.eq("professional_id", opts.professionalId)

  const { data, error } = await query
  if (error) throw error
  return hydrateAppointments(supabase, data ?? [])
}

export async function countPendingClosures(
  supabase: DB,
  clinicId: string,
  opts: { professionalId?: string } = {}
): Promise<number> {
  let query = supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .in("status", ["scheduled", "confirmed"])
    .lt("scheduled_at", new Date().toISOString())

  if (opts.professionalId) query = query.eq("professional_id", opts.professionalId)

  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

export async function getAppointment(supabase: DB, clinicId: string, appointmentId: string) {
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("id", appointmentId)
    .single()
  if (error) throw error
  return data
}

export async function createAppointment(supabase: DB, clinicId: string, createdBy: string, input: AppointmentInput) {
  const { data, error } = await supabase
    .from("appointments")
    .insert({ ...input, clinic_id: clinicId, created_by: createdBy })
    .select("id")
    .single()
  if (error) throw error
  return data
}

export async function rescheduleAppointment(
  supabase: DB,
  clinicId: string,
  appointmentId: string,
  input: Partial<AppointmentInput>
) {
  const { error } = await supabase
    .from("appointments")
    .update(input)
    .eq("clinic_id", clinicId)
    .eq("id", appointmentId)
  if (error) throw error
}

/**
 * Why this appointment cannot be hard-deleted, or null when it can.
 *
 * `queue_entries`, `medical_records` and `financial_transactions` all reference
 * `appointments(id)` with no `on delete` action, so a delete with any of those attached
 * fails with a raw foreign-key error. More importantly, deleting an appointment that
 * actually happened would erase the operational trail — cancelling is the right move there.
 * Deletion exists only for the "created by mistake" case, where nothing hangs off it yet.
 */
export async function findAppointmentDeletionBlocker(
  supabase: DB,
  clinicId: string,
  appointmentId: string
): Promise<string | null> {
  const appointment = await getAppointment(supabase, clinicId, appointmentId)

  if (appointment.checked_in_at) {
    return "Este paciente já fez check-in. Use Cancelar, que preserva o histórico do atendimento."
  }
  if (appointment.status === "completed") {
    return "Um atendimento concluído não pode ser excluído. O histórico clínico depende dele."
  }

  const [{ count: queueCount }, { count: recordCount }, { count: chargeCount }] = await Promise.all([
    supabase
      .from("queue_entries")
      .select("id", { count: "exact", head: true })
      .eq("appointment_id", appointmentId),
    supabase
      .from("medical_records")
      .select("id", { count: "exact", head: true })
      .eq("appointment_id", appointmentId),
    supabase
      .from("financial_transactions")
      .select("id", { count: "exact", head: true })
      .eq("appointment_id", appointmentId),
  ])

  if ((queueCount ?? 0) > 0) {
    return "Este agendamento já entrou na fila. Use Cancelar em vez de excluir."
  }
  if ((recordCount ?? 0) > 0) {
    return "Existe prontuário vinculado a este agendamento. Ele não pode ser excluído."
  }
  if ((chargeCount ?? 0) > 0) {
    return "Existe cobrança vinculada a este agendamento. Cancele a cobrança primeiro, ou use Cancelar."
  }

  return null
}

export async function deleteAppointment(supabase: DB, clinicId: string, appointmentId: string) {
  const { data, error } = await supabase
    .from("appointments")
    .delete()
    .eq("clinic_id", clinicId)
    .eq("id", appointmentId)
    .select("id")
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error("Agendamento não encontrado nesta clínica.")
  }
}

export async function setAppointmentStatus(
  supabase: DB,
  clinicId: string,
  appointmentId: string,
  status: AppointmentStatus,
  cancelledReason?: string | null
) {
  const { error } = await supabase
    .from("appointments")
    .update({ status, cancelled_reason: cancelledReason ?? null })
    .eq("clinic_id", clinicId)
    .eq("id", appointmentId)
  if (error) throw error
}

/**
 * Falta: `justified` grava se a ausência foi justificada, o que decide (na Server
 * Action) se a sessão de pacote associada é liberada (justificada) ou consumida (não
 * justificada) — item confirmado com a clínica: só consome quando não há justificativa.
 */
export async function setAppointmentNoShow(
  supabase: DB,
  clinicId: string,
  appointmentId: string,
  justified: boolean
) {
  const { error } = await supabase
    .from("appointments")
    .update({ status: "no_show", no_show_justified: justified })
    .eq("clinic_id", clinicId)
    .eq("id", appointmentId)
  if (error) throw error
}
