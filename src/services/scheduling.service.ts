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
}

export async function hydrateAppointments(
  supabase: DB,
  appointments: Database["public"]["Tables"]["appointments"]["Row"][]
): Promise<AppointmentView[]> {
  if (appointments.length === 0) return []

  const patientIds = [...new Set(appointments.map((a) => a.patient_id))]
  const professionalIds = [...new Set(appointments.map((a) => a.professional_id))]
  const procedureIds = [...new Set(appointments.map((a) => a.procedure_id).filter(Boolean))] as string[]

  const [{ data: patients }, { data: professionals }, { data: procedures }] = await Promise.all([
    supabase.from("patients").select("id, full_name, social_name").in("id", patientIds),
    supabase.from("professionals").select("id, full_name").in("id", professionalIds),
    procedureIds.length > 0
      ? supabase.from("procedures").select("id, name").in("id", procedureIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  const patientById = new Map((patients ?? []).map((p) => [p.id, p]))
  const professionalById = new Map((professionals ?? []).map((p) => [p.id, p.full_name]))
  const procedureById = new Map((procedures ?? []).map((p) => [p.id, p.name]))

  return appointments.map((appointment) => {
    const patient = patientById.get(appointment.patient_id)
    return {
      ...appointment,
      patientName: patient?.social_name || patient?.full_name || "—",
      professionalName: professionalById.get(appointment.professional_id) ?? "—",
      procedureName: appointment.procedure_id ? procedureById.get(appointment.procedure_id) ?? null : null,
    }
  })
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
