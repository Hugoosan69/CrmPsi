"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import { getProfessionalByUserId } from "@/services/professionals.service"
import {
  availabilitySchema,
  roomSchema,
  scheduleExceptionSchema,
} from "@/schemas/availability.schema"
import {
  createAvailability,
  createOwnAvailability,
  deleteOwnAvailability,
  createRoom,
  createScheduleException,
  deleteAvailability,
  deleteScheduleException,
  updateRoom,
} from "@/services/availability.service"
import { recordAudit } from "@/services/audit.service"
import { describeDbError } from "@/lib/db-errors"

export type AvailabilityActionState = { error?: string; success?: boolean }

function revalidateAgendaConfig() {
  revalidatePath("/gestao/agenda")
  revalidatePath("/recepcao/agenda")
  revalidatePath("/profissional/agenda")
  revalidatePath("/dashboard")
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export async function createRoomAction(
  _prev: AvailabilityActionState,
  formData: FormData
): Promise<AvailabilityActionState> {
  const membership = await requirePermission(PERMISSIONS.SETTINGS_MANAGE)

  const parsed = roomSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }

  const supabase = await createClient()
  let id: string
  try {
    id = await createRoom(supabase, membership.clinicId, parsed.data)
  } catch (err) {
    return { error: describeDbError(err) }
  }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "room.create",
    entityType: "room",
    entityId: id,
    after: parsed.data,
  })

  revalidateAgendaConfig()
  return { success: true }
}

export async function setRoomActiveAction(roomId: string, active: boolean) {
  const membership = await requirePermission(PERMISSIONS.SETTINGS_MANAGE)
  const supabase = await createClient()

  await updateRoom(supabase, membership.clinicId, roomId, { active })

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: active ? "room.activate" : "room.deactivate",
    entityType: "room",
    entityId: roomId,
  })

  revalidateAgendaConfig()
}

// ---------------------------------------------------------------------------
// Weekly availability
// ---------------------------------------------------------------------------

export async function createAvailabilityAction(
  _prev: AvailabilityActionState,
  formData: FormData
): Promise<AvailabilityActionState> {
  const membership = await requirePermission(PERMISSIONS.SETTINGS_MANAGE)

  const parsed = availabilitySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }

  const supabase = await createClient()
  let id: string
  try {
    id = await createAvailability(supabase, membership.clinicId, parsed.data)
  } catch (err) {
    return { error: describeDbError(err) }
  }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "availability.create",
    entityType: "professional_availability",
    entityId: id,
    after: parsed.data,
  })

  revalidateAgendaConfig()
  return { success: true }
}

export async function deleteAvailabilityAction(id: string) {
  const membership = await requirePermission(PERMISSIONS.SETTINGS_MANAGE)
  const supabase = await createClient()

  await deleteAvailability(supabase, membership.clinicId, id)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "availability.delete",
    entityType: "professional_availability",
    entityId: id,
  })

  revalidateAgendaConfig()
}

// ---------------------------------------------------------------------------
// Blocks and extra shifts
// ---------------------------------------------------------------------------

export async function createScheduleExceptionAction(
  _prev: AvailabilityActionState,
  formData: FormData
): Promise<AvailabilityActionState> {
  const membership = await requirePermission(PERMISSIONS.AGENDA_MANAGE)

  const parsed = scheduleExceptionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }

  const supabase = await createClient()
  let id: string
  try {
    id = await createScheduleException(supabase, membership.clinicId, membership.userId, parsed.data)
  } catch (err) {
    return { error: describeDbError(err) }
  }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "schedule_exception.create",
    entityType: "schedule_exception",
    entityId: id,
    after: parsed.data,
  })

  revalidateAgendaConfig()
  return { success: true }
}

export async function deleteScheduleExceptionAction(id: string) {
  const membership = await requirePermission(PERMISSIONS.AGENDA_MANAGE)
  const supabase = await createClient()

  await deleteScheduleException(supabase, membership.clinicId, id)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "schedule_exception.delete",
    entityType: "schedule_exception",
    entityId: id,
  })

  revalidateAgendaConfig()
}

/**
 * Horários do PRÓPRIO profissional.
 *
 * Existe separado de createAvailabilityAction porque a permissão é outra: aquela exige
 * settings.manage — configurar a clínica inteira —, e um profissional que só precisa dizer
 * quando trabalha não deveria receber junto o poder de mexer em salas, procedimentos e nos
 * horários dos colegas. Aqui basta service.manage, e o alvo nunca vem do formulário: é
 * sempre a ficha vinculada ao login de quem chamou.
 */
export async function createOwnAvailabilityAction(
  _prev: AvailabilityActionState,
  formData: FormData
): Promise<AvailabilityActionState> {
  const membership = await requirePermission(PERMISSIONS.SERVICE_MANAGE)
  const supabase = await createClient()

  const professional = await getProfessionalByUserId(
    supabase,
    membership.clinicId,
    membership.userId
  )
  if (!professional) {
    return {
      error:
        "Seu login ainda não está vinculado a uma ficha de profissional. Peça à gestão para fazer o vínculo em Usuários.",
    }
  }

  const parsed = availabilitySchema.safeParse({
    // professional_id vem da sessão, nunca do formulário.
    professional_id: professional.id,
    weekday: formData.get("weekday"),
    start_time: formData.get("start_time"),
    end_time: formData.get("end_time"),
    slot_minutes: formData.get("slot_minutes"),
    room_id: formData.get("room_id") ?? "",
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  try {
    await createOwnAvailability(membership.clinicId, professional.id, {
      weekday: parsed.data.weekday,
      start_time: parsed.data.start_time,
      end_time: parsed.data.end_time,
      slot_minutes: parsed.data.slot_minutes,
      room_id: parsed.data.room_id,
    })
  } catch (err) {
    console.error("createOwnAvailabilityAction failed", err)
    return { error: describeDbError(err) }
  }

  revalidatePath("/profissional/agenda")
  revalidatePath("/gestao/agenda")
  return { success: true }
}

export async function deleteOwnAvailabilityAction(id: string) {
  const membership = await requirePermission(PERMISSIONS.SERVICE_MANAGE)
  const supabase = await createClient()

  const professional = await getProfessionalByUserId(
    supabase,
    membership.clinicId,
    membership.userId
  )
  if (!professional) throw new Error("Login sem ficha de profissional vinculada.")

  await deleteOwnAvailability(membership.clinicId, professional.id, id)

  revalidatePath("/profissional/agenda")
  revalidatePath("/gestao/agenda")
}
