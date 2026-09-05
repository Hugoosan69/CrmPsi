"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import { appointmentSchema } from "@/schemas/appointment.schema"
import {
  createAppointment,
  deleteAppointment,
  findAppointmentDeletionBlocker,
  getAppointment,
  rescheduleAppointment,
  setAppointmentStatus,
  setAppointmentNoShow,
} from "@/services/scheduling.service"
import { checkInAppointment, markQueueEntriesReleasedForTransaction } from "@/services/queue.service"
import { getProcedure } from "@/services/procedures.service"
import { createTransaction } from "@/services/financial.service"
import {
  reservePackageSession,
  releasePackageSession,
  consumePackageSession,
  createPackageSessionCharge,
  getPackageSessionForAppointment,
} from "@/services/packages.service"
import { recordAudit } from "@/services/audit.service"
import { notify, profileIdsForProfessionals } from "@/services/notifications.service"
import { describeDbError } from "@/lib/db-errors"
import { findSlotProblem } from "@/services/availability.service"
import { describeSlotProblem } from "@/config/agenda"
import { formatDateTime } from "@/utils/datetime"

export type AppointmentActionState = { error?: string; success?: boolean }

function revalidateAgenda() {
  revalidatePath("/recepcao/agenda")
  revalidatePath("/profissional/agenda")
}

export async function createAppointmentAction(
  _prev: AppointmentActionState,
  formData: FormData
): Promise<AppointmentActionState> {
  const membership = await requirePermission(PERMISSIONS.AGENDA_MANAGE)

  const parsed = appointmentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createClient()

  // Availability, blocks, professional and room conflicts — checked here for a message
  // the receptionist can act on. The exclusion constraints in migrations/002 are the
  // race-proof backstop for two people booking the same slot at the same moment.
  const problem = await findSlotProblem(supabase, membership.clinicId, {
    professionalId: parsed.data.professional_id,
    roomId: parsed.data.room_id,
    startsAt: parsed.data.scheduled_at,
    durationMinutes: parsed.data.duration_minutes,
  })
  if (problem) return { error: describeSlotProblem(problem)! }

  // patient_package_id não é coluna de appointments — é o saldo a reservar, tratado à
  // parte logo abaixo.
  const { patient_package_id, ...appointmentInput } = parsed.data

  let created: { id: string }
  try {
    created = await createAppointment(supabase, membership.clinicId, membership.userId, appointmentInput)
    if (patient_package_id) {
      await reservePackageSession(supabase, membership.clinicId, {
        patientPackageId: patient_package_id,
        appointmentId: created.id,
      })
    }
  } catch (err) {
    return { error: describeDbError(err) }
  }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "appointment.create",
    entityType: "appointment",
    entityId: created.id,
    after: parsed.data,
  })

  revalidateAgenda()
  return { success: true }
}

export async function rescheduleAppointmentAction(
  appointmentId: string,
  _prev: AppointmentActionState,
  formData: FormData
): Promise<AppointmentActionState> {
  const membership = await requirePermission(PERMISSIONS.AGENDA_MANAGE)

  const parsed = appointmentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createClient()

  // Same gate as creation, minus this appointment's own reservation — otherwise every
  // reschedule would collide with the slot it is moving out of.
  const problem = await findSlotProblem(supabase, membership.clinicId, {
    professionalId: parsed.data.professional_id,
    roomId: parsed.data.room_id,
    startsAt: parsed.data.scheduled_at,
    durationMinutes: parsed.data.duration_minutes,
    excludeAppointmentId: appointmentId,
  })
  if (problem) return { error: describeSlotProblem(problem)! }

  // Reagendar não mexe no vínculo de pacote já feito na criação — só muda horário/sala/
  // profissional. patient_package_id não é coluna de appointments, por isso sai do objeto
  // antes do update (senão o Supabase reclama de uma coluna inexistente).
  const { patient_package_id, status, ...appointmentInput } = parsed.data
  void patient_package_id

  // O seletor do formulário só conhece "Agendado" e "Triagem". Reagendar uma consulta que
  // já foi confirmada (ou concluída) não pode fazê-la regredir para "Agendado" só porque o
  // campo veio com o padrão — a situação só é reescrita quando ainda é uma das duas.
  const current = await getAppointment(supabase, membership.clinicId, appointmentId)
  const nextStatus =
    current.status === "scheduled" || current.status === "triagem" ? status : undefined

  try {
    await rescheduleAppointment(supabase, membership.clinicId, appointmentId, {
      ...appointmentInput,
      ...(nextStatus ? { status: nextStatus } : {}),
    })
  } catch (err) {
    return { error: describeDbError(err) }
  }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "appointment.reschedule",
    entityType: "appointment",
    entityId: appointmentId,
    after: parsed.data,
  })

  revalidateAgenda()
  return { success: true }
}

export async function cancelAppointmentAction(appointmentId: string, reason: string) {
  const membership = await requirePermission(PERMISSIONS.AGENDA_MANAGE)

  const supabase = await createClient()
  // Read before the update, so the notification can name the slot that just freed up.
  const appointment = await getAppointment(supabase, membership.clinicId, appointmentId)
  await setAppointmentStatus(supabase, membership.clinicId, appointmentId, "cancelled", reason)

  // Cancelar sempre libera a posição do pacote sem consumir — o paciente não usou a
  // sessão, então ela volta a ficar disponível.
  if (appointment.patient_package_session_id) {
    await releasePackageSession(supabase, appointment.patient_package_session_id)
  }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "appointment.cancel",
    entityType: "appointment",
    entityId: appointmentId,
    after: { reason },
  })

  const recipients = await profileIdsForProfessionals(supabase, membership.clinicId, [
    appointment.professional_id,
  ])
  await notify({
    clinicId: membership.clinicId,
    userIds: recipients,
    kind: "agenda",
    title: "Agendamento cancelado",
    body: [`${formatDateTime(appointment.scheduled_at)}`, reason ? `Motivo: ${reason}` : null]
      .filter(Boolean)
      .join(" · "),
    href: "/profissional/agenda",
    entityType: "appointment",
    entityId: appointmentId,
    exceptUserId: membership.userId,
  })

  revalidateAgenda()
}

/**
 * Hard delete, for an appointment created by mistake. Refuses whenever anything
 * operational hangs off it — see findAppointmentDeletionBlocker. The audit row is written
 * *before* the delete so the trail outlives the record.
 */
export async function deleteAppointmentAction(
  appointmentId: string
): Promise<{ error?: string; success?: boolean }> {
  const membership = await requirePermission(PERMISSIONS.AGENDA_MANAGE)
  const supabase = await createClient()

  let blocker: string | null
  let appointment: Awaited<ReturnType<typeof getAppointment>>
  try {
    appointment = await getAppointment(supabase, membership.clinicId, appointmentId)
    blocker = await findAppointmentDeletionBlocker(supabase, membership.clinicId, appointmentId)
  } catch (err) {
    return { error: describeDbError(err) }
  }
  if (blocker) return { error: blocker }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "appointment.delete",
    entityType: "appointment",
    entityId: appointmentId,
    before: {
      patient_id: appointment.patient_id,
      professional_id: appointment.professional_id,
      scheduled_at: appointment.scheduled_at,
      duration_minutes: appointment.duration_minutes,
      status: appointment.status,
    },
  })

  try {
    await deleteAppointment(supabase, membership.clinicId, appointmentId)
  } catch (err) {
    return { error: describeDbError(err) }
  }

  revalidateAgenda()
  return { success: true }
}

export async function confirmAppointmentAction(appointmentId: string) {
  const membership = await requirePermission(PERMISSIONS.AGENDA_MANAGE)

  const supabase = await createClient()
  await setAppointmentStatus(supabase, membership.clinicId, appointmentId, "confirmed")

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "appointment.confirm",
    entityType: "appointment",
    entityId: appointmentId,
  })

  revalidateAgenda()
}

/**
 * Falta. `justified` decide o destino da sessão de pacote (se houver): justificada
 * libera a posição (o paciente pode remarcar sem perder a sessão); não justificada
 * consome — a clínica reservou a vaga e ela não apareceu sem aviso.
 */
export async function markNoShowAppointmentAction(appointmentId: string, justified: boolean) {
  const membership = await requirePermission(PERMISSIONS.AGENDA_MANAGE)

  const supabase = await createClient()
  const appointment = await getAppointment(supabase, membership.clinicId, appointmentId)
  await setAppointmentNoShow(supabase, membership.clinicId, appointmentId, justified)

  if (appointment.patient_package_session_id) {
    if (justified) {
      await releasePackageSession(supabase, appointment.patient_package_session_id)
    } else {
      await consumePackageSession(supabase, appointment.patient_package_session_id)
    }
  }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "appointment.no_show",
    entityType: "appointment",
    entityId: appointmentId,
    after: { justified },
  })

  revalidateAgenda()
}

/**
 * Fecha o agendamento como atendido, sem passar pela fila.
 *
 * O ciclo oficial (check-in → fila → cronômetro → finalizar) marca `completed` sozinho,
 * mas a clínica atende muita gente sem usar a fila — e aí o agendamento fica "confirmado"
 * para sempre, ninguém sabe o que aconteceu e a sessão do pacote nunca é debitada. Este é
 * o fechamento manual: mesmo efeito, feito por quem atendeu.
 */
export async function completeAppointmentAction(appointmentId: string) {
  const membership = await requirePermission(PERMISSIONS.AGENDA_MANAGE)

  const supabase = await createClient()
  const appointment = await getAppointment(supabase, membership.clinicId, appointmentId)
  await setAppointmentStatus(supabase, membership.clinicId, appointmentId, "completed")

  // Mesma regra do finishService: a sessão só é consumida quando o atendimento de fato
  // aconteceu, e é aqui que isso passa a ser verdade.
  if (appointment.patient_package_session_id) {
    await consumePackageSession(supabase, appointment.patient_package_session_id)
  }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "appointment.complete",
    entityType: "appointment",
    entityId: appointmentId,
  })

  revalidateAgenda()
  revalidatePath(`/recepcao/pacientes/${appointment.patient_id}`)
  revalidatePath(`/profissional/pacientes/${appointment.patient_id}`)
}

export type CheckInState = { error?: string; success?: boolean }

/**
 * CSIB rule: check-in does NOT put the patient in the queue. It records arrival and
 * opens the charge that gates entry — the patient sits at `payment_pending` until
 * reception settles it. See database/migrations/001 for the database-level guard.
 *
 * `amount` is optional: when the appointment has a priced procedure we use that price,
 * otherwise reception types the value in (audit decision — never block arrival because
 * a procedure has no price yet).
 */
export async function checkInAppointmentAction(
  appointmentId: string,
  _prev: CheckInState,
  formData: FormData
): Promise<CheckInState> {
  const membership = await requirePermission(PERMISSIONS.QUEUE_MANAGE)
  const supabase = await createClient()

  const appointment = await getAppointment(supabase, membership.clinicId, appointmentId)

  if (appointment.checked_in_at) {
    return { error: "Este agendamento já teve check-in." }
  }

  const procedure = appointment.procedure_id
    ? await getProcedure(supabase, membership.clinicId, appointment.procedure_id)
    : null

  // Sessão de pacote: já paga integralmente na venda, então esta cobrança nasce com
  // R$ 0,00 e status "pago" — libera direto para a fila, sem etapa de cobrança na
  // recepção (requisito 5). Fora isso o fluxo é idêntico ao avulso.
  if (appointment.patient_package_session_id) {
    const packageSession = await getPackageSessionForAppointment(supabase, appointment.id)
    let transactionId: string
    let queueEntryId: string
    try {
      transactionId = await createPackageSessionCharge(supabase, membership.clinicId, {
        patientId: appointment.patient_id,
        appointmentId: appointment.id,
        createdBy: membership.userId,
        category: procedure?.name ?? "Atendimento",
        patientPackageSessionId: appointment.patient_package_session_id,
      })
      queueEntryId = await checkInAppointment(supabase, membership.clinicId, {
        appointmentId: appointment.id,
        patientId: appointment.patient_id,
        professionalId: appointment.professional_id,
        financialTransactionId: transactionId,
      })
      await markQueueEntriesReleasedForTransaction(supabase, membership.clinicId, transactionId)
    } catch (err) {
      return { error: describeDbError(err) }
    }

    await recordAudit({
      clinicId: membership.clinicId,
      userId: membership.userId,
      action: "appointment.check_in",
      entityType: "appointment",
      entityId: appointmentId,
      after: { queueEntryId, financialTransactionId: transactionId, packageSession: !!packageSession },
    })

    revalidateAgenda()
    revalidatePath("/recepcao/fila")
    revalidatePath("/recepcao/financeiro")
    return { success: true }
  }

  const rawAmount = formData.get("amount")
  const typedAmount = typeof rawAmount === "string" && rawAmount.trim() ? Number(rawAmount) : null
  const amount = typedAmount ?? (procedure ? Number(procedure.price) : null)

  if (amount === null || Number.isNaN(amount) || amount <= 0) {
    return {
      error:
        "Informe o valor a cobrar. O procedimento deste agendamento não tem preço cadastrado.",
    }
  }

  // Charge first, then the gated queue entry — if the charge fails we never create a
  // queue row, so a patient can't end up present-but-uncharged.
  let transactionId: string
  let queueEntryId: string
  try {
    transactionId = await createTransaction(supabase, membership.clinicId, membership.userId, {
      patient_id: appointment.patient_id,
      appointment_id: appointment.id,
      type: "receita",
      category: procedure?.name ?? "Atendimento",
      description: procedure ? `Atendimento — ${procedure.name}` : "Atendimento",
      amount,
    })

    queueEntryId = await checkInAppointment(supabase, membership.clinicId, {
      appointmentId: appointment.id,
      patientId: appointment.patient_id,
      professionalId: appointment.professional_id,
      financialTransactionId: transactionId,
    })
  } catch (err) {
    return { error: describeDbError(err) }
  }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "appointment.check_in",
    entityType: "appointment",
    entityId: appointmentId,
    after: { queueEntryId, financialTransactionId: transactionId, amount },
  })

  revalidateAgenda()
  revalidatePath("/recepcao/fila")
  revalidatePath("/recepcao/financeiro")
  return { success: true }
}
