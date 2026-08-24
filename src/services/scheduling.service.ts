import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { AppointmentStatus, Database } from "@/types/supabase"

type DB = SupabaseClient<Database>

export type AppointmentInput = {
  patient_id: string
  professional_id: string
  procedure_id?: string | null
  scheduled_at: string
  duration_minutes: number
  notes?: string | null
}

function dayRange(date: string) {
  const start = `${date}T00:00:00`
  const end = `${date}T23:59:59.999`
  return { start, end }
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
