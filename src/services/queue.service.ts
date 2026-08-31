import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, FinancialTransactionStatus, QueueEntryType } from "@/types/supabase"

type DB = SupabaseClient<Database>
type QueueEntryRow = Database["public"]["Tables"]["queue_entries"]["Row"]

export type QueueEntryView = QueueEntryRow & {
  patientName: string
  professionalName: string | null
  specialtyName: string | null
  /** Minutes since arrival, computed server-side so the board never depends on the
   * receptionist's clock being right (same principle as the service timer). */
  waitingMinutes: number
  /** Gating charge, when there is one — drives the "PAGAMENTO PENDENTE" card. */
  charge: { id: string; amount: number; status: FinancialTransactionStatus; description: string | null } | null
}

/**
 * Two distinct bands of the lifecycle (see database/migrations/001):
 *
 *  PRE_QUEUE: payment_pending → released     — physically present, not callable yet
 *  IN_QUEUE:  waiting → called → in_service ⇄ paused
 *
 * Reception needs to see both bands (it owns the payment step); professionals only
 * ever see IN_QUEUE, so an unpaid patient can never be called by mistake.
 */
export const PRE_QUEUE_STATUSES = ["payment_pending", "released"] as const
export const IN_QUEUE_STATUSES = ["waiting", "called", "in_service", "paused"] as const
const ALL_LIVE_STATUSES = [...PRE_QUEUE_STATUSES, ...IN_QUEUE_STATUSES]

async function hydrate(supabase: DB, entries: QueueEntryRow[]): Promise<QueueEntryView[]> {
  if (entries.length === 0) return []

  const patientIds = [...new Set(entries.map((e) => e.patient_id))]
  const professionalIds = [...new Set(entries.map((e) => e.professional_id).filter(Boolean))] as string[]
  const specialtyIds = [...new Set(entries.map((e) => e.specialty_id).filter(Boolean))] as string[]

  const [{ data: patients }, { data: professionals }, { data: specialties }] = await Promise.all([
    supabase.from("patients").select("id, full_name, social_name").in("id", patientIds),
    professionalIds.length > 0
      ? supabase.from("professionals").select("id, full_name").in("id", professionalIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    specialtyIds.length > 0
      ? supabase.from("specialties").select("id, name").in("id", specialtyIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  const chargeIds = [...new Set(entries.map((e) => e.financial_transaction_id).filter(Boolean))] as string[]
  const { data: charges } = chargeIds.length > 0
    ? await supabase
        .from("financial_transactions")
        .select("id, amount, status, description")
        .in("id", chargeIds)
    : { data: [] as { id: string; amount: number; status: FinancialTransactionStatus; description: string | null }[] }

  const patientById = new Map((patients ?? []).map((p) => [p.id, p]))
  const professionalById = new Map((professionals ?? []).map((p) => [p.id, p.full_name]))
  const specialtyById = new Map((specialties ?? []).map((s) => [s.id, s.name]))
  const chargeById = new Map((charges ?? []).map((c) => [c.id, c]))
  const now = Date.now()

  return entries.map((entry) => {
    const patient = patientById.get(entry.patient_id)
    // Waiting stops accruing once the patient is actually being seen.
    const reference = entry.service_started_at ? new Date(entry.service_started_at).getTime() : now
    const charge = entry.financial_transaction_id ? chargeById.get(entry.financial_transaction_id) : undefined
    return {
      ...entry,
      patientName: patient?.social_name || patient?.full_name || "—",
      professionalName: entry.professional_id ? professionalById.get(entry.professional_id) ?? null : null,
      specialtyName: entry.specialty_id ? specialtyById.get(entry.specialty_id) ?? null : null,
      waitingMinutes: Math.max(
        0,
        Math.floor((reference - new Date(entry.arrived_at).getTime()) / 60000)
      ),
      charge: charge
        ? { id: charge.id, amount: Number(charge.amount), status: charge.status, description: charge.description }
        : null,
    }
  })
}

export async function listActiveQueue(
  supabase: DB,
  clinicId: string,
  opts: { professionalId?: string; band?: "all" | "in_queue" } = {}
): Promise<QueueEntryView[]> {
  const statuses = opts.band === "in_queue" ? [...IN_QUEUE_STATUSES] : ALL_LIVE_STATUSES

  let query = supabase
    .from("queue_entries")
    .select("*")
    .eq("clinic_id", clinicId)
    .in("status", statuses)
    .order("priority", { ascending: false })
    .order("arrived_at", { ascending: true })

  if (opts.professionalId) query = query.eq("professional_id", opts.professionalId)

  const { data, error } = await query
  if (error) throw error
  return hydrate(supabase, data ?? [])
}

export async function getQueueEntry(supabase: DB, clinicId: string, queueEntryId: string) {
  const { data, error } = await supabase
    .from("queue_entries")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("id", queueEntryId)
    .single()
  if (error) throw error
  return data
}

/**
 * Check-in does NOT put the patient in the queue — it records that they are physically
 * present and opens the charge that gates entry. The row lands as `payment_pending`,
 * which professionals never see. Payment is what releases it.
 */
export async function checkInAppointment(
  supabase: DB,
  clinicId: string,
  input: {
    appointmentId: string
    patientId: string
    professionalId: string
    financialTransactionId: string
  }
) {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from("queue_entries")
    .insert({
      clinic_id: clinicId,
      patient_id: input.patientId,
      appointment_id: input.appointmentId,
      professional_id: input.professionalId,
      entry_type: "scheduled",
      status: "payment_pending",
      financial_transaction_id: input.financialTransactionId,
    })
    .select("id")
    .single()
  if (error) throw error

  const { error: apptError } = await supabase
    .from("appointments")
    .update({ checked_in_at: now })
    .eq("clinic_id", clinicId)
    .eq("id", input.appointmentId)
  if (apptError) throw apptError

  return data.id
}

/** Walk-in / fit-in: same gate. Reception picks procedure + professional, the charge is
 * created, and the patient waits at `payment_pending` until it is settled. */
export async function addWalkInToQueue(
  supabase: DB,
  clinicId: string,
  input: {
    patientId: string
    professionalId?: string | null
    specialtyId?: string | null
    entryType: QueueEntryType
    financialTransactionId: string
  }
) {
  const { data, error } = await supabase
    .from("queue_entries")
    .insert({
      clinic_id: clinicId,
      patient_id: input.patientId,
      professional_id: input.professionalId ?? null,
      specialty_id: input.specialtyId ?? null,
      entry_type: input.entryType,
      status: "payment_pending",
      financial_transaction_id: input.financialTransactionId,
    })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

/** Called after a payment settles: moves the gate from pending to released, so the
 * reception board can offer "ENVIAR PARA FILA". Never sends to the queue by itself —
 * the receptionist controls that moment. */
export async function markQueueEntriesReleasedForTransaction(
  supabase: DB,
  clinicId: string,
  financialTransactionId: string
) {
  const { error } = await supabase
    .from("queue_entries")
    .update({ status: "released" })
    .eq("clinic_id", clinicId)
    .eq("financial_transaction_id", financialTransactionId)
    .eq("status", "payment_pending")
  if (error) throw error
}

/** The explicit "ENVIAR PARA FILA" step. The database trigger re-verifies payment, so
 * this cannot be forced through by a stale page or a hand-crafted request. */
export async function releaseQueueEntryToQueue(
  supabase: DB,
  clinicId: string,
  queueEntryId: string,
  releasedBy: string
) {
  const { error } = await supabase
    .from("queue_entries")
    .update({ status: "waiting", released_at: new Date().toISOString(), released_by: releasedBy })
    .eq("clinic_id", clinicId)
    .eq("id", queueEntryId)
    .in("status", ["payment_pending", "released"])
  if (error) throw error
}

export async function callQueueEntry(supabase: DB, clinicId: string, queueEntryId: string) {
  const { error } = await supabase
    .from("queue_entries")
    .update({ status: "called", called_at: new Date().toISOString() })
    .eq("clinic_id", clinicId)
    .eq("id", queueEntryId)
  if (error) throw error
}

export async function cancelQueueEntry(supabase: DB, clinicId: string, queueEntryId: string) {
  const { error } = await supabase
    .from("queue_entries")
    .update({ status: "cancelled" })
    .eq("clinic_id", clinicId)
    .eq("id", queueEntryId)
  if (error) throw error
}

/**
 * Reassigns the patient and records the handover. Closing the outgoing professional's
 * service session is the caller's job (features/queue/actions) — without that the old
 * session keeps accruing time forever, which was a real defect found in the audit.
 * Sending the entry back to `waiting` (not `payment_pending`) is deliberate: the visit
 * is already paid for, so a transfer must never re-charge the patient.
 */
export async function transferQueueEntry(
  supabase: DB,
  clinicId: string,
  input: { queueEntryId: string; fromProfessionalId: string | null; toProfessionalId: string; reason: string | null; transferredBy: string }
) {
  const { error: updateError } = await supabase
    .from("queue_entries")
    .update({
      professional_id: input.toProfessionalId,
      status: "waiting",
      called_at: null,
      service_started_at: null,
    })
    .eq("clinic_id", clinicId)
    .eq("id", input.queueEntryId)
  if (updateError) throw updateError

  const { error: transferError } = await supabase.from("queue_transfers").insert({
    queue_entry_id: input.queueEntryId,
    from_professional_id: input.fromProfessionalId,
    to_professional_id: input.toProfessionalId,
    reason: input.reason,
    transferred_by: input.transferredBy,
  })
  if (transferError) throw transferError
}

/**
 * Chamadas em aberto — quem foi chamado e ainda não entrou no consultório.
 *
 * Consulta própria, enxuta, em vez de reaproveitar `listActiveQueue`: o aviso de chamada
 * precisa estar em pé em QUALQUER tela do sistema (a recepcionista raramente está com a
 * fila aberta quando o profissional chama), e fazer isso consultando a fila inteira a cada
 * poucos segundos, de todas as telas, sairia caro pelo que se usa.
 *
 * A sala vem do agendamento, quando há um. Encaixe não tem agendamento e portanto não tem
 * sala — nesse caso o que orienta o paciente é o nome de quem chamou, que é a informação
 * que sempre existe.
 */
export type PendingCall = {
  id: string
  patientName: string
  professionalName: string | null
  roomName: string | null
  calledAt: string | null
}

export async function listPendingCalls(
  supabase: DB,
  clinicId: string
): Promise<PendingCall[]> {
  const { data: entries, error } = await supabase
    .from("queue_entries")
    .select("id, patient_id, professional_id, appointment_id, called_at")
    .eq("clinic_id", clinicId)
    .eq("status", "called")
    .order("called_at", { ascending: true })
  if (error) throw error
  if (!entries || entries.length === 0) return []

  const patientIds = [...new Set(entries.map((e) => e.patient_id))]
  const professionalIds = [
    ...new Set(entries.map((e) => e.professional_id).filter(Boolean)),
  ] as string[]
  const appointmentIds = [
    ...new Set(entries.map((e) => e.appointment_id).filter(Boolean)),
  ] as string[]

  const [{ data: patients }, { data: professionals }, { data: appointments }] = await Promise.all([
    supabase.from("patients").select("id, full_name, social_name").in("id", patientIds),
    professionalIds.length > 0
      ? supabase.from("professionals").select("id, full_name").in("id", professionalIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    appointmentIds.length > 0
      ? supabase.from("appointments").select("id, room_id").in("id", appointmentIds)
      : Promise.resolve({ data: [] as { id: string; room_id: string | null }[] }),
  ])

  const roomIds = [
    ...new Set((appointments ?? []).map((a) => a.room_id).filter(Boolean)),
  ] as string[]
  const { data: rooms } = roomIds.length > 0
    ? await supabase.from("rooms").select("id, name").in("id", roomIds)
    : { data: [] as { id: string; name: string }[] }

  const patientById = new Map((patients ?? []).map((p) => [p.id, p]))
  const professionalById = new Map((professionals ?? []).map((p) => [p.id, p.full_name]))
  const roomByAppointment = new Map(
    (appointments ?? []).map((a) => [a.id, a.room_id])
  )
  const roomNameById = new Map((rooms ?? []).map((r) => [r.id, r.name]))

  return entries.map((entry) => {
    const patient = patientById.get(entry.patient_id)
    const roomId = entry.appointment_id ? roomByAppointment.get(entry.appointment_id) : null
    return {
      id: entry.id,
      patientName: patient?.social_name || patient?.full_name || "—",
      professionalName: entry.professional_id
        ? professionalById.get(entry.professional_id) ?? null
        : null,
      roomName: roomId ? roomNameById.get(roomId) ?? null : null,
      calledAt: entry.called_at,
    }
  })
}
