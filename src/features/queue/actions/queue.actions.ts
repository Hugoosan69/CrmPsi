"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import {
  acknowledgeCall,
  addWalkInToQueue,
  cancelQueueEntry,
  callQueueEntry,
  getQueueEntry,
  listActiveQueue,
  listPendingCalls,
  releaseQueueEntryToQueue,
  transferQueueEntry,
} from "@/services/queue.service"
import { createTransaction, getTransaction } from "@/services/financial.service"
import { getProcedure } from "@/services/procedures.service"
import {
  closeSessionForTransfer,
  getServiceSessionForQueueEntry,
} from "@/services/service.service"
import { recordAudit } from "@/services/audit.service"
import {
  frontDeskProfileIds,
  notify,
  profileIdsForProfessionals,
} from "@/services/notifications.service"
import { getPatient } from "@/services/patients.service"
import { describeDbError, withDbError } from "@/lib/db-errors"
import type { QueueEntryType } from "@/types/supabase"

function revalidateQueue() {
  revalidatePath("/recepcao/fila")
  revalidatePath("/profissional/fila")
  revalidatePath("/profissional/agenda")
}

/** `band: "in_queue"` hides the pre-payment band — professionals must never see, let
 * alone call, a patient whose payment isn't settled. */
export async function getQueueSnapshotAction(
  professionalId?: string,
  band: "all" | "in_queue" = "all"
) {
  const membership = await requirePermission(PERMISSIONS.QUEUE_MANAGE)
  const supabase = await createClient()
  return withDbError(() => listActiveQueue(supabase, membership.clinicId, { professionalId, band }))
}

/** The explicit "ENVIAR PARA FILA" step. Refuses politely when the charge is unpaid,
 * and the database trigger refuses again underneath — the UI is not the gate. */
export async function releaseToQueueAction(queueEntryId: string): Promise<{ error?: string }> {
  const membership = await requirePermission(PERMISSIONS.QUEUE_MANAGE)
  const supabase = await createClient()

  const entry = await getQueueEntry(supabase, membership.clinicId, queueEntryId)

  if (!entry.financial_transaction_id) {
    return { error: "Este paciente não tem cobrança vinculada. Registre a cobrança antes de liberar." }
  }

  const charge = await getTransaction(supabase, membership.clinicId, entry.financial_transaction_id)
  if (charge.status !== "pago") {
    return {
      error: "Pagamento pendente: este paciente precisa ter o pagamento confirmado antes de entrar na fila.",
    }
  }

  try {
    await releaseQueueEntryToQueue(supabase, membership.clinicId, queueEntryId, membership.userId)
  } catch (err) {
    console.error("releaseToQueueAction blocked", err)
    return { error: "Não foi possível liberar este paciente. Verifique o pagamento e tente novamente." }
  }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "queue.release_to_queue",
    entityType: "queue_entry",
    entityId: queueEntryId,
  })

  // The professional is the one who needs to know a patient just entered their queue —
  // until now they had to keep the fila open and notice the row appear.
  const [patient, recipients] = await Promise.all([
    getPatient(supabase, membership.clinicId, entry.patient_id).catch(() => null),
    profileIdsForProfessionals(supabase, membership.clinicId, [entry.professional_id]),
  ])
  await notify({
    clinicId: membership.clinicId,
    userIds: recipients,
    kind: "queue",
    title: "Paciente liberado para a sua fila",
    body: patient ? `${patient.social_name || patient.full_name} está aguardando.` : null,
    href: "/profissional/fila",
    entityType: "queue_entry",
    entityId: queueEntryId,
    exceptUserId: membership.userId,
  })

  revalidateQueue()
  return {}
}

export type AddToQueueState = { error?: string; success?: boolean }

export async function addWalkInToQueueAction(
  _prev: AddToQueueState,
  formData: FormData
): Promise<AddToQueueState> {
  const membership = await requirePermission(PERMISSIONS.QUEUE_MANAGE)

  const patientId = formData.get("patient_id")
  const professionalId = formData.get("professional_id")
  const specialtyId = formData.get("specialty_id")
  const procedureId = formData.get("procedure_id")
  const rawAmount = formData.get("amount")

  if (typeof patientId !== "string" || !patientId) {
    return { error: "Selecione um paciente" }
  }

  const supabase = await createClient()

  // Walk-ins go through the same gate: pick what is being done, charge it, and only
  // then does the patient become releasable to the queue.
  const procedure =
    typeof procedureId === "string" && procedureId
      ? await getProcedure(supabase, membership.clinicId, procedureId)
      : null

  const typedAmount = typeof rawAmount === "string" && rawAmount.trim() ? Number(rawAmount) : null
  const amount = typedAmount ?? (procedure ? Number(procedure.price) : null)

  if (amount === null || Number.isNaN(amount) || amount <= 0) {
    return { error: "Informe o procedimento ou o valor a cobrar." }
  }

  let transactionId: string
  let queueEntryId: string
  try {
    transactionId = await createTransaction(supabase, membership.clinicId, membership.userId, {
      patient_id: patientId,
      type: "receita",
      category: procedure?.name ?? "Encaixe",
      description: procedure ? `Encaixe — ${procedure.name}` : "Encaixe",
      amount,
    })

    queueEntryId = await addWalkInToQueue(supabase, membership.clinicId, {
      patientId,
      professionalId: typeof professionalId === "string" && professionalId ? professionalId : null,
      specialtyId: typeof specialtyId === "string" && specialtyId ? specialtyId : null,
      entryType: "walk_in" as QueueEntryType,
      financialTransactionId: transactionId,
    })
  } catch (err) {
    return { error: describeDbError(err) }
  }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "queue.add_walk_in",
    entityType: "queue_entry",
    entityId: queueEntryId,
    after: {
      patientId,
      professionalId: typeof professionalId === "string" ? professionalId : null,
      financialTransactionId: transactionId,
      amount,
    },
  })

  revalidateQueue()
  revalidatePath("/recepcao/financeiro")
  return { success: true }
}

export async function callQueueEntryAction(queueEntryId: string) {
  const membership = await requirePermission(PERMISSIONS.QUEUE_MANAGE)

  const supabase = await createClient()
  await callQueueEntry(supabase, membership.clinicId, queueEntryId)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "queue.call",
    entityType: "queue_entry",
    entityId: queueEntryId,
  })

  // Quem precisa saber é o balcão, que é quem fala com o paciente na sala de espera. O
  // profissional aperta "chamar" no consultório e não tem como avisar ninguém dali.
  //
  // Endereçado por função e não por papel — ver frontDeskProfileIds. `exceptUserId` cobre o
  // caso em que a própria recepção chamou o paciente pela tela da fila: aí ela já sabe, e um
  // aviso sobre a própria ação só ensina a ignorar avisos.
  try {
    // Lido DEPOIS da chamada e pela mesma consulta que alimenta o aviso na tela, para que o
    // texto da notificação e o do pop-up nunca contem histórias diferentes.
    const [recipients, calls] = await Promise.all([
      frontDeskProfileIds(supabase, membership.clinicId),
      listPendingCalls(supabase, membership.clinicId),
    ])
    const call = calls.find((c) => c.id === queueEntryId)

    const destino = call?.roomName
      ? `Sala ${call.roomName}`
      : call?.professionalName
        ? call.professionalName
        : "o atendimento"

    await notify({
      clinicId: membership.clinicId,
      userIds: recipients,
      exceptUserId: membership.userId,
      kind: "queue",
      title: `Chamar ${call?.patientName ?? "paciente"} na recepção`,
      body: `Avise o paciente para se dirigir a ${destino}.`,
      href: "/recepcao/fila",
      entityType: "queue_entry",
      entityId: queueEntryId,
    })
  } catch (err) {
    // Um aviso não desfaz uma chamada que já aconteceu.
    console.error("aviso de chamada falhou", err)
  }

  revalidateQueue()
}

/**
 * Chamadas em aberto, para o aviso que roda em qualquer tela.
 *
 * Separada de `getQueueSnapshotAction` de propósito: aquela devolve a fila inteira e é
 * consultada de 5 em 5 segundos pela tela da fila. Esta é consultada pelo aviso, que está
 * montado em TODAS as telas de quem opera a fila — carregar a fila completa a cada poucos
 * segundos, em toda navegação, sairia caro pelo que se usa.
 */
export async function pendingCallsAction() {
  const membership = await requirePermission(PERMISSIONS.QUEUE_MANAGE)
  const supabase = await createClient()
  return withDbError(() => listPendingCalls(supabase, membership.clinicId))
}

export async function cancelQueueEntryAction(queueEntryId: string) {
  const membership = await requirePermission(PERMISSIONS.QUEUE_MANAGE)

  const supabase = await createClient()
  await cancelQueueEntry(supabase, membership.clinicId, queueEntryId)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "queue.cancel",
    entityType: "queue_entry",
    entityId: queueEntryId,
  })

  revalidateQueue()
}

export async function transferQueueEntryAction(
  queueEntryId: string,
  fromProfessionalId: string | null,
  toProfessionalId: string,
  reason: string
) {
  const membership = await requirePermission(PERMISSIONS.SERVICE_MANAGE)

  const supabase = await createClient()

  // Audit finding: the outgoing professional's session used to be left open, so its
  // timer kept accruing forever. Close and settle it before reassigning.
  const openSession = await getServiceSessionForQueueEntry(supabase, queueEntryId)
  let closedTimes: { totalSeconds: number; effectiveSeconds: number; pausedSeconds: number } | null = null
  if (openSession && !openSession.finished_at) {
    closedTimes = await closeSessionForTransfer(supabase, openSession.id, membership.userId)
  }

  await transferQueueEntry(supabase, membership.clinicId, {
    queueEntryId,
    fromProfessionalId,
    toProfessionalId,
    reason: reason || null,
    transferredBy: membership.userId,
  })

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "queue.transfer",
    entityType: "queue_entry",
    entityId: queueEntryId,
    after: {
      fromProfessionalId,
      toProfessionalId,
      reason,
      closedSessionId: openSession?.id ?? null,
      closedSessionTimes: closedTimes,
    },
  })

  // A transfer is the clearest case for a notification: the receiving professional took no
  // action and has no reason to be looking at their fila right now.
  const entry = await getQueueEntry(supabase, membership.clinicId, queueEntryId)
  const [patient, recipients] = await Promise.all([
    getPatient(supabase, membership.clinicId, entry.patient_id).catch(() => null),
    profileIdsForProfessionals(supabase, membership.clinicId, [toProfessionalId]),
  ])
  await notify({
    clinicId: membership.clinicId,
    userIds: recipients,
    kind: "queue",
    title: "Paciente transferido para você",
    body: [
      patient ? patient.social_name || patient.full_name : null,
      reason ? `Motivo: ${reason}` : null,
    ]
      .filter(Boolean)
      .join(" · ") || null,
    href: "/profissional/fila",
    entityType: "queue_entry",
    entityId: queueEntryId,
    exceptUserId: membership.userId,
  })

  revalidateQueue()
}

/**
 * Registra que o balcão avisou o paciente — compartilhado entre quem está lá.
 *
 * Devolve estado em vez de lançar: um erro aqui aparece dentro do cartão, sem tirar da tela a
 * chamada que ainda precisa ser atendida.
 */
export async function acknowledgeCallAction(
  queueEntryId: string
): Promise<{ error?: string }> {
  const membership = await requirePermission(PERMISSIONS.QUEUE_MANAGE)
  const supabase = await createClient()

  try {
    await acknowledgeCall(supabase, membership.clinicId, queueEntryId, membership.userId)
  } catch (err) {
    console.error("acknowledgeCallAction failed", err)
    return { error: describeDbError(err) }
  }

  revalidateQueue()
  return {}
}
