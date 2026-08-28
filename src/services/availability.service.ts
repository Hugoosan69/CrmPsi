import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"

import type { Database, ScheduleExceptionKind, SlotProblem } from "@/types/supabase"
import { pendingMigrationFor } from "@/lib/db-errors"
import type { AvailabilityRule, Room, ScheduleException } from "@/config/agenda"
import { CLINIC_UTC_OFFSET } from "@/utils/datetime"

type DB = SupabaseClient<Database>

export type { AvailabilityRule, Room, ScheduleException } from "@/config/agenda"

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export async function listRooms(supabase: DB, clinicId: string, opts: { activeOnly?: boolean } = {}) {
  let query = supabase.from("rooms").select("*").eq("clinic_id", clinicId).order("name")
  if (opts.activeOnly) query = query.eq("active", true)

  const { data, error } = await query
  if (error) throw error
  return data
}

/**
 * Rooms for screens where they are an optional enhancement (the agenda form) rather than
 * the subject. Returns an empty list when migrations/002 has not been applied yet, so the
 * room field simply doesn't appear instead of taking the agenda down — the dashboard and
 * /gestao/agenda are where the pending migration is reported.
 */
export async function listRoomsIfAvailable(supabase: DB, clinicId: string): Promise<Room[]> {
  try {
    return await listRooms(supabase, clinicId, { activeOnly: true })
  } catch (err) {
    if (pendingMigrationFor(err)) return []
    throw err
  }
}

export async function createRoom(
  supabase: DB,
  clinicId: string,
  input: { name: string; kind: string; capacity: number; notes: string | null }
) {
  const { data, error } = await supabase
    .from("rooms")
    .insert({ ...input, clinic_id: clinicId })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

export async function updateRoom(
  supabase: DB,
  clinicId: string,
  roomId: string,
  input: Partial<{ name: string; kind: string; capacity: number; notes: string | null; active: boolean }>
) {
  const { data, error } = await supabase
    .from("rooms")
    .update(input)
    .eq("clinic_id", clinicId)
    .eq("id", roomId)
    .select("id")
  if (error) throw error
  // A filter that matches nothing is not an error in PostgREST — say so rather than
  // letting the UI report a success that never happened.
  if (!data || data.length === 0) throw new Error("Sala não encontrada nesta clínica.")
}

// ---------------------------------------------------------------------------
// Weekly availability
// ---------------------------------------------------------------------------

export async function listAvailability(supabase: DB, clinicId: string, professionalId?: string) {
  let query = supabase
    .from("professional_availability")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("weekday")
    .order("start_time")

  if (professionalId) query = query.eq("professional_id", professionalId)

  const { data, error } = await query
  if (error) throw error
  return data
}

/**
 * Availability and blocks for the calendar views, where they are background context. Same
 * tolerance as listRoomsIfAvailable: before migrations/002 the calendar draws without the
 * availability band instead of taking the agenda down. The dashboard and /gestao/agenda
 * are where the pending migration gets reported.
 */
export async function listAvailabilityIfAvailable(
  supabase: DB,
  clinicId: string,
  professionalId?: string
): Promise<AvailabilityRule[]> {
  try {
    return await listAvailability(supabase, clinicId, professionalId)
  } catch (err) {
    if (pendingMigrationFor(err)) return []
    throw err
  }
}

export async function listScheduleExceptionsIfAvailable(
  supabase: DB,
  clinicId: string,
  opts: { from?: string; to?: string; professionalId?: string } = {}
): Promise<ScheduleException[]> {
  try {
    // The window is a clinic-local date range; compare against timestamptz with the
    // clinic offset made explicit, as everywhere else.
    return await listScheduleExceptions(supabase, clinicId, {
      ...opts,
      from: opts.from ? `${opts.from}T00:00:00${CLINIC_UTC_OFFSET}` : undefined,
      to: opts.to ? `${opts.to}T23:59:59.999${CLINIC_UTC_OFFSET}` : undefined,
    })
  } catch (err) {
    if (pendingMigrationFor(err)) return []
    throw err
  }
}

export async function createAvailability(
  supabase: DB,
  clinicId: string,
  input: {
    professional_id: string
    weekday: number
    start_time: string
    end_time: string
    slot_minutes: number
    room_id: string | null
  }
) {
  const { data, error } = await supabase
    .from("professional_availability")
    .insert({ ...input, clinic_id: clinicId })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

export async function deleteAvailability(supabase: DB, clinicId: string, id: string) {
  const { data, error } = await supabase
    .from("professional_availability")
    .delete()
    .eq("clinic_id", clinicId)
    .eq("id", id)
    .select("id")
  if (error) throw error
  if (!data || data.length === 0) throw new Error("Horário não encontrado nesta clínica.")
}

// ---------------------------------------------------------------------------
// Exceptions (blocks and extra shifts)
// ---------------------------------------------------------------------------

export async function listScheduleExceptions(
  supabase: DB,
  clinicId: string,
  opts: { from?: string; to?: string; professionalId?: string } = {}
) {
  let query = supabase
    .from("schedule_exceptions")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("starts_at", { ascending: false })

  if (opts.from) query = query.gte("ends_at", opts.from)
  if (opts.to) query = query.lte("starts_at", opts.to)
  if (opts.professionalId) query = query.eq("professional_id", opts.professionalId)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createScheduleException(
  supabase: DB,
  clinicId: string,
  createdBy: string,
  input: {
    professional_id: string | null
    kind: ScheduleExceptionKind
    starts_at: string
    ends_at: string
    reason: string | null
  }
) {
  const { data, error } = await supabase
    .from("schedule_exceptions")
    .insert({ ...input, clinic_id: clinicId, created_by: createdBy })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

export async function deleteScheduleException(supabase: DB, clinicId: string, id: string) {
  const { data, error } = await supabase
    .from("schedule_exceptions")
    .delete()
    .eq("clinic_id", clinicId)
    .eq("id", id)
    .select("id")
  if (error) throw error
  if (!data || data.length === 0) throw new Error("Bloqueio não encontrado nesta clínica.")
}

// ---------------------------------------------------------------------------
// Slot validation and free-slot lookup — both delegate to SQL so the agenda,
// the check-in flow, and any future online booking share one definition.
// ---------------------------------------------------------------------------

export async function findSlotProblem(
  supabase: DB,
  clinicId: string,
  input: {
    professionalId: string
    roomId: string | null
    startsAt: string
    durationMinutes: number
    excludeAppointmentId?: string | null
  }
): Promise<SlotProblem | null> {
  const { data, error } = await supabase.rpc("appointment_slot_problem", {
    p_clinic: clinicId,
    p_professional: input.professionalId,
    p_room: input.roomId,
    p_start: input.startsAt,
    p_duration: input.durationMinutes,
    p_exclude: input.excludeAppointmentId ?? null,
  })
  if (error) throw error
  return data
}

export async function listFreeSlots(
  supabase: DB,
  clinicId: string,
  input: { professionalId: string; date: string; durationMinutes?: number }
) {
  const { data, error } = await supabase.rpc("professional_free_slots", {
    p_clinic: clinicId,
    p_professional: input.professionalId,
    p_date: input.date,
    p_duration: input.durationMinutes ?? null,
  })
  if (error) throw error
  return data ?? []
}

export type OccupancyRow = {
  professionalId: string
  availableMinutes: number
  bookedMinutes: number
  /** 0–1, or null when the professional has no availability configured at all. */
  rate: number | null
}

export async function getOccupancy(
  supabase: DB,
  clinicId: string,
  from: string,
  to: string
): Promise<OccupancyRow[]> {
  const { data, error } = await supabase.rpc("clinic_occupancy", {
    p_clinic: clinicId,
    p_from: from,
    p_to: to,
  })
  if (error) throw error

  return (data ?? []).map((row) => {
    const available = Number(row.available_minutes)
    const booked = Number(row.booked_minutes)
    return {
      professionalId: row.professional_id,
      availableMinutes: available,
      bookedMinutes: booked,
      rate: available > 0 ? booked / available : null,
    }
  })
}

/**
 * Cria um horário conferindo, no próprio SQL, que a ficha pertence à clínica indicada.
 *
 * A RLS de `professional_availability` exige `settings.manage` para escrita, que é a
 * permissão de configurar a clínica inteira — dar isso a um profissional só para ele
 * definir os próprios dias seria conceder junto o poder de mexer em salas, procedimentos e
 * nos horários dos colegas. Por isso a escrita aqui usa service role, e a verificação de que
 * a linha é dele acontece na camada de aplicação, explicitamente.
 */
export async function createOwnAvailability(
  clinicId: string,
  professionalId: string,
  input: {
    weekday: number
    start_time: string
    end_time: string
    slot_minutes: number
    room_id: string | null
  }
) {
  const admin = createAdminClient()

  // Reconfirma o dono antes de gravar: `professionalId` chega da sessão, mas confiar nele
  // sem checar deixaria a porta aberta caso alguma chamada futura o receba de outro lugar.
  const { data: owned, error: ownError } = await admin
    .from("professionals")
    .select("id")
    .eq("id", professionalId)
    .eq("clinic_id", clinicId)
    .maybeSingle()
  if (ownError) throw ownError
  if (!owned) throw new Error("Ficha de profissional não encontrada nesta clínica.")

  const { data, error } = await admin
    .from("professional_availability")
    .insert({ ...input, professional_id: professionalId, clinic_id: clinicId })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

/** Remove um horário apenas se ele for do profissional indicado — o filtro por
 *  professional_id é o que impede apagar o horário de um colega passando outro id. */
export async function deleteOwnAvailability(
  clinicId: string,
  professionalId: string,
  id: string
) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("professional_availability")
    .delete()
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .eq("professional_id", professionalId)
    .select("id")
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error("Horário não encontrado, ou não pertence a você.")
  }
}
