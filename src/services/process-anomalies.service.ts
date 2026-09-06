import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

type DB = SupabaseClient<Database>

export type ProcessAnomaly = {
  id: string
  type: "payment_not_queued" | "orphaned_queue_entry" | "stale_pending_payment"
  severity: "info" | "warning" | "critical"
  appointmentId?: string
  patientName?: string
  professionalName?: string
  amount?: number
  description: string
  detectedAt: string
  resolvedAt?: string
}

/**
 * Detecta atendimentos com pagamento confirmado mas não enviados para a fila
 * do profissional. Anomalia crítica que impede a execução do serviço.
 */
export async function listPaymentNotQueuedAnomalies(
  supabase: DB,
  clinicId: string,
  opts: { limit?: number } = {}
) {
  return detectPaymentNotQueuedAnomaliesFallback(supabase, clinicId, opts)
}

/**
 * Fallback: query manual sem RPC, em caso de migration não aplicada.
 */
async function detectPaymentNotQueuedAnomaliesFallback(
  supabase: DB,
  clinicId: string,
  opts: { limit?: number } = {}
) {
  const { data: appointments, error } = await supabase
    .from("appointments")
    .select(
      `
      id,
      scheduled_at,
      status,
      patient:patients(full_name, social_name),
      professional:professionals(full_name),
      transaction:financial_transactions(id, status, amount),
      queue_entry:queue_entries(id)
    `
    )
    .eq("clinic_id", clinicId)
    .in("status", ["scheduled", "confirmed"])
    .limit(opts.limit ?? 100)

  if (error) throw error

  const anomalies = (appointments ?? [])
    .filter((apt: any) => {
      const hasConfirmedPayment = apt.transaction?.some((t: any) => t.status === "pago")
      const hasQueueEntry = apt.queue_entry && apt.queue_entry.length > 0
      return hasConfirmedPayment && !hasQueueEntry
    })
    .map((apt: any) => ({
      appointmentId: apt.id,
      patientName: apt.patient?.social_name || apt.patient?.full_name,
      professionalName: apt.professional?.full_name,
      amount: apt.transaction?.[0]?.amount,
      scheduledAt: apt.scheduled_at,
      description: `Agendamento ${apt.id} tem pagamento confirmado mas não está na fila do profissional`,
    }))

  return anomalies
}

/**
 * Lista atendimentos com entrada na fila mas que já foram concluídos/cancelados
 * (fila não foi limpa).
 */
export async function listOrphanedQueueEntriesAnomalies(
  supabase: DB,
  clinicId: string,
  opts: { limit?: number } = {}
) {
  const { data, error } = await supabase
    .from("queue_entries")
    .select(
      `
      id,
      appointment:appointments(
        id, status,
        patient:patients(full_name, social_name),
        professional:professionals(full_name)
      )
    `
    )
    .eq("clinic_id", clinicId)
    .in("status", ["waiting", "called", "in_service"])
    .limit(opts.limit ?? 100)

  if (error) throw error

  const anomalies = (data ?? [])
    .filter((qe: any) => {
      const appointment = qe.appointment
      return (
        appointment &&
        (appointment.status === "completed" || appointment.status === "cancelled" ||
          appointment.status === "no_show")
      )
    })
    .map((qe: any) => ({
      queueEntryId: qe.id,
      appointmentId: qe.appointment.id,
      appointmentStatus: qe.appointment.status,
      patientName: qe.appointment.patient?.social_name || qe.appointment.patient?.full_name,
      description: `Entrada na fila ${qe.id} de agendamento ${qe.appointment.status}`,
    }))

  return anomalies
}

/**
 * Atendimentos que ficaram muito tempo em "payment_pending" (nunca foram
 * confirmados nem cancelados).
 */
export async function listStalePendingPaymentsAnomalies(
  supabase: DB,
  clinicId: string,
  opts: { staleHours?: number; limit?: number } = {}
) {
  const staleHours = opts.staleHours ?? 24
  const cutoffTime = new Date()
  cutoffTime.setHours(cutoffTime.getHours() - staleHours)

  const { data, error } = await supabase
    .from("queue_entries")
    .select(
      `
      id,
      appointment:appointments(
        id, created_at,
        patient:patients(full_name, social_name),
        professional:professionals(full_name)
      )
    `
    )
    .eq("clinic_id", clinicId)
    .eq("status", "payment_pending")
    .lt("created_at", cutoffTime.toISOString())
    .limit(opts.limit ?? 100)

  if (error) throw error

  return (data ?? [])
    .map((qe: any) => ({
      queueEntryId: qe.id,
      appointmentId: qe.appointment.id,
      patientName: qe.appointment.patient?.social_name || qe.appointment.patient?.full_name,
      createdAt: qe.appointment.created_at,
      hoursStale: staleHours,
      description: `Fila pendente por pagamento há ${staleHours}+ horas`,
    }))
}

/**
 * Procura por TODAS as anomalias de uma só vez.
 */
export async function detectAllAnomalies(supabase: DB, clinicId: string) {
  const [paymentNotQueued, orphanedQueue, stalePending] = await Promise.all([
    listPaymentNotQueuedAnomalies(supabase, clinicId),
    listOrphanedQueueEntriesAnomalies(supabase, clinicId),
    listStalePendingPaymentsAnomalies(supabase, clinicId),
  ])

  return {
    paymentNotQueued,
    orphanedQueue,
    stalePending,
    totalCount: paymentNotQueued.length + orphanedQueue.length + stalePending.length,
  }
}
