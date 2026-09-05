import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/supabase"
import { consumePackageSession } from "@/services/packages.service"

type DB = SupabaseClient<Database>
type ServiceSessionEvent = Database["public"]["Tables"]["service_session_events"]["Row"]

/**
 * Item 14: the timer is a rendering of durable DB timestamps, never the browser clock.
 * Walks the append-only event log chronologically to derive elapsed running time —
 * the same events double as the audit trail for tempo médio/efetivo analytics later.
 */
export function computeElapsed(events: Pick<ServiceSessionEvent, "event_type" | "occurred_at">[], now: number) {
  let accumulatedMs = 0
  let runStart: number | null = null

  const sorted = [...events].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  )

  for (const event of sorted) {
    const at = new Date(event.occurred_at).getTime()
    if (event.event_type === "start" || event.event_type === "resume") {
      runStart = at
    } else if (event.event_type === "pause" || event.event_type === "finish") {
      if (runStart !== null) {
        accumulatedMs += at - runStart
        runStart = null
      }
    }
  }

  const isRunning = runStart !== null
  const totalMs = accumulatedMs + (isRunning ? now - runStart! : 0)
  return { elapsedSeconds: Math.max(0, Math.floor(totalMs / 1000)), isRunning }
}

/**
 * Settles the three figures item 8.4 asks for, from the same event log:
 *   total     = wall clock, first event to last
 *   effective = time actually attending (what computeElapsed measures)
 *   paused    = the difference
 * Written once at finish so reports never have to replay events.
 */
export function summarizeSession(events: Pick<ServiceSessionEvent, "event_type" | "occurred_at">[]) {
  if (events.length === 0) return { totalSeconds: 0, effectiveSeconds: 0, pausedSeconds: 0 }

  const times = events.map((e) => new Date(e.occurred_at).getTime())
  const first = Math.min(...times)
  const last = Math.max(...times)
  const totalSeconds = Math.max(0, Math.floor((last - first) / 1000))
  // `last` as "now" makes this independent of when the summary happens to run.
  const { elapsedSeconds: effectiveSeconds } = computeElapsed(events, last)

  return {
    totalSeconds,
    effectiveSeconds,
    pausedSeconds: Math.max(0, totalSeconds - effectiveSeconds),
  }
}

export async function getServiceSessionForQueueEntry(supabase: DB, queueEntryId: string) {
  const { data, error } = await supabase
    .from("service_sessions")
    .select("*")
    .eq("queue_entry_id", queueEntryId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Consolidated times per VISIT, keyed by queue entry. Deliberately not keyed by
 * medical_records.service_session_id: a visit can legitimately have several sessions
 * (each transfer closes one and opens another), and the record is created before any
 * session exists. Summing by queue entry gives the true total the patient was attended,
 * across every professional who saw them.
 */
export async function sumEffectiveSecondsByQueueEntry(supabase: DB, queueEntryIds: string[]) {
  const result = new Map<string, number>()
  if (queueEntryIds.length === 0) return result

  const { data, error } = await supabase
    .from("service_sessions")
    .select("queue_entry_id, effective_seconds")
    .in("queue_entry_id", queueEntryIds)
  if (error) throw error

  for (const row of data ?? []) {
    if (row.effective_seconds === null) continue
    result.set(row.queue_entry_id, (result.get(row.queue_entry_id) ?? 0) + row.effective_seconds)
  }
  return result
}

export async function listServiceSessionEvents(supabase: DB, serviceSessionId: string) {
  const { data, error } = await supabase
    .from("service_session_events")
    .select("*")
    .eq("service_session_id", serviceSessionId)
    .order("occurred_at")
  if (error) throw error
  return data ?? []
}

export async function startService(
  supabase: DB,
  clinicId: string,
  input: { queueEntryId: string; professionalId: string; patientId: string; createdBy: string }
) {
  const now = new Date().toISOString()

  const { data: session, error: sessionError } = await supabase
    .from("service_sessions")
    .insert({
      clinic_id: clinicId,
      queue_entry_id: input.queueEntryId,
      professional_id: input.professionalId,
      patient_id: input.patientId,
      started_at: now,
    })
    .select("id")
    .single()
  if (sessionError) throw sessionError

  const { error: eventError } = await supabase.from("service_session_events").insert({
    service_session_id: session.id,
    event_type: "start",
    occurred_at: now,
    created_by: input.createdBy,
  })
  if (eventError) throw eventError

  const { error: queueError } = await supabase
    .from("queue_entries")
    .update({ status: "in_service", service_started_at: now })
    .eq("clinic_id", clinicId)
    .eq("id", input.queueEntryId)
  if (queueError) throw queueError

  return session.id
}

async function addEvent(
  supabase: DB,
  serviceSessionId: string,
  eventType: "pause" | "resume" | "finish",
  createdBy: string
) {
  const { error } = await supabase.from("service_session_events").insert({
    service_session_id: serviceSessionId,
    event_type: eventType,
    occurred_at: new Date().toISOString(),
    created_by: createdBy,
  })
  if (error) throw error
}

export async function pauseService(
  supabase: DB,
  clinicId: string,
  input: { queueEntryId: string; serviceSessionId: string; createdBy: string }
) {
  await addEvent(supabase, input.serviceSessionId, "pause", input.createdBy)
  const { error } = await supabase
    .from("queue_entries")
    .update({ status: "paused" })
    .eq("clinic_id", clinicId)
    .eq("id", input.queueEntryId)
  if (error) throw error
}

export async function resumeService(
  supabase: DB,
  clinicId: string,
  input: { queueEntryId: string; serviceSessionId: string; createdBy: string }
) {
  await addEvent(supabase, input.serviceSessionId, "resume", input.createdBy)
  const { error } = await supabase
    .from("queue_entries")
    .update({ status: "in_service" })
    .eq("clinic_id", clinicId)
    .eq("id", input.queueEntryId)
  if (error) throw error
}

/** Closes a session and settles its consolidated times. Shared by "finalizar" and by
 * transfer (which must close the outgoing professional's session — see audit finding). */
async function closeSession(supabase: DB, serviceSessionId: string, createdBy: string) {
  const now = new Date().toISOString()
  await addEvent(supabase, serviceSessionId, "finish", createdBy)

  const events = await listServiceSessionEvents(supabase, serviceSessionId)
  const { totalSeconds, effectiveSeconds, pausedSeconds } = summarizeSession(events)

  const { error } = await supabase
    .from("service_sessions")
    .update({
      finished_at: now,
      total_seconds: totalSeconds,
      effective_seconds: effectiveSeconds,
      total_paused_seconds: pausedSeconds,
    })
    .eq("id", serviceSessionId)
  if (error) throw error

  return { totalSeconds, effectiveSeconds, pausedSeconds }
}

export async function finishService(
  supabase: DB,
  clinicId: string,
  input: { queueEntryId: string; serviceSessionId: string; appointmentId: string | null; createdBy: string }
) {
  const now = new Date().toISOString()
  const times = await closeSession(supabase, input.serviceSessionId, input.createdBy)

  const { error: queueError } = await supabase
    .from("queue_entries")
    .update({ status: "completed", finished_at: now })
    .eq("clinic_id", clinicId)
    .eq("id", input.queueEntryId)
  if (queueError) throw queueError

  if (input.appointmentId) {
    const { data: appointment, error: apptError } = await supabase
      .from("appointments")
      .update({ status: "completed" })
      .eq("clinic_id", clinicId)
      .eq("id", input.appointmentId)
      .select("patient_package_session_id")
      .single()
    if (apptError) throw apptError

    // Consumo real do saldo de pacote: só aqui, quando o atendimento de fato aconteceu —
    // agendar apenas reserva a posição (ver reservePackageSession).
    if (appointment.patient_package_session_id) {
      await consumePackageSession(supabase, appointment.patient_package_session_id)
    }
  }

  return times
}

/** Ends the outgoing professional's session at handover, preserving its measured time.
 * The incoming professional's "Iniciar atendimento" opens a fresh session, so the
 * patient ends up with one session per professional and a complete history. */
export async function closeSessionForTransfer(
  supabase: DB,
  serviceSessionId: string,
  createdBy: string
) {
  return closeSession(supabase, serviceSessionId, createdBy)
}
