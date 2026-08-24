"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import { getQueueEntry } from "@/services/queue.service"
import {
  computeElapsed,
  finishService,
  getServiceSessionForQueueEntry,
  listServiceSessionEvents,
  pauseService,
  resumeService,
  startService,
} from "@/services/service.service"
import { getTransaction } from "@/services/financial.service"
import { recordAudit } from "@/services/audit.service"

function revalidateService() {
  revalidatePath("/profissional/fila")
  revalidatePath("/profissional/agenda")
  revalidatePath("/recepcao/fila")
}

export async function getTimerSnapshotAction(queueEntryId: string) {
  await requirePermission(PERMISSIONS.SERVICE_MANAGE)
  const supabase = await createClient()

  const session = await getServiceSessionForQueueEntry(supabase, queueEntryId)
  if (!session) return { hasSession: false as const }

  const events = await listServiceSessionEvents(supabase, session.id)
  const { elapsedSeconds, isRunning } = computeElapsed(events, Date.now())
  return { hasSession: true as const, sessionId: session.id, elapsedSeconds, isRunning, finished: !!session.finished_at }
}

export async function startServiceAction(queueEntryId: string) {
  const membership = await requirePermission(PERMISSIONS.SERVICE_MANAGE)
  const supabase = await createClient()

  const entry = await getQueueEntry(supabase, membership.clinicId, queueEntryId)

  // Third layer of the same rule (UI hides it, DB trigger blocks it, and this refuses):
  // a service can never begin for a patient whose payment isn't settled.
  if (!entry.financial_transaction_id) {
    throw new Error("Pagamento pendente: este atendimento não tem cobrança vinculada.")
  }
  const charge = await getTransaction(supabase, membership.clinicId, entry.financial_transaction_id)
  if (charge.status !== "pago") {
    throw new Error(
      "Pagamento pendente: este paciente precisa ter o pagamento confirmado antes do atendimento."
    )
  }

  const sessionId = await startService(supabase, membership.clinicId, {
    queueEntryId,
    professionalId: entry.professional_id ?? membership.userId,
    patientId: entry.patient_id,
    createdBy: membership.userId,
  })

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "service.start",
    entityType: "service_session",
    entityId: sessionId,
  })

  revalidateService()
}

export async function pauseServiceAction(queueEntryId: string) {
  const membership = await requirePermission(PERMISSIONS.SERVICE_MANAGE)
  const supabase = await createClient()

  const session = await getServiceSessionForQueueEntry(supabase, queueEntryId)
  if (!session) throw new Error("Sessão de atendimento não encontrada")

  await pauseService(supabase, membership.clinicId, {
    queueEntryId,
    serviceSessionId: session.id,
    createdBy: membership.userId,
  })

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "service.pause",
    entityType: "service_session",
    entityId: session.id,
  })

  revalidateService()
}

export async function resumeServiceAction(queueEntryId: string) {
  const membership = await requirePermission(PERMISSIONS.SERVICE_MANAGE)
  const supabase = await createClient()

  const session = await getServiceSessionForQueueEntry(supabase, queueEntryId)
  if (!session) throw new Error("Sessão de atendimento não encontrada")

  await resumeService(supabase, membership.clinicId, {
    queueEntryId,
    serviceSessionId: session.id,
    createdBy: membership.userId,
  })

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "service.resume",
    entityType: "service_session",
    entityId: session.id,
  })

  revalidateService()
}

export async function finishServiceAction(queueEntryId: string) {
  const membership = await requirePermission(PERMISSIONS.SERVICE_MANAGE)
  const supabase = await createClient()

  const [entry, session] = await Promise.all([
    getQueueEntry(supabase, membership.clinicId, queueEntryId),
    getServiceSessionForQueueEntry(supabase, queueEntryId),
  ])
  if (!session) throw new Error("Sessão de atendimento não encontrada")

  await finishService(supabase, membership.clinicId, {
    queueEntryId,
    serviceSessionId: session.id,
    appointmentId: entry.appointment_id,
    createdBy: membership.userId,
  })

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "service.finish",
    entityType: "service_session",
    entityId: session.id,
  })

  // NOTE: no charge is created here. Under the CSIB rule payment happens at check-in,
  // before the patient may enter the queue at all — creating a receita at finish would
  // both duplicate the charge and invert the official flow.
  revalidateService()
}
