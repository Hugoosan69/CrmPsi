"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import { appointmentSchema } from "@/schemas/appointment.schema"
import {
  createAppointment,
  getAppointment,
  rescheduleAppointment,
  setAppointmentStatus,
} from "@/services/scheduling.service"
import { checkInAppointment } from "@/services/queue.service"
import { getProcedure } from "@/services/procedures.service"
import { createTransaction } from "@/services/financial.service"
import { recordAudit } from "@/services/audit.service"
import { describeDbError } from "@/lib/db-errors"

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
  const created = await createAppointment(supabase, membership.clinicId, membership.userId, parsed.data)

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
  await rescheduleAppointment(supabase, membership.clinicId, appointmentId, parsed.data)

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
  await setAppointmentStatus(supabase, membership.clinicId, appointmentId, "cancelled", reason)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "appointment.cancel",
    entityType: "appointment",
    entityId: appointmentId,
    after: { reason },
  })

  revalidateAgenda()
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

export async function markNoShowAppointmentAction(appointmentId: string) {
  const membership = await requirePermission(PERMISSIONS.AGENDA_MANAGE)

  const supabase = await createClient()
  await setAppointmentStatus(supabase, membership.clinicId, appointmentId, "no_show")

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "appointment.no_show",
    entityType: "appointment",
    entityId: appointmentId,
  })

  revalidateAgenda()
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
