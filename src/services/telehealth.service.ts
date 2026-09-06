import "server-only"

import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, VideoCallRole, VideoCallStatus } from "@/types/supabase"

type DB = SupabaseClient<Database>

export type VideoCall = Database["public"]["Tables"]["video_calls"]["Row"]
export type VideoCallMessage = Database["public"]["Tables"]["video_call_messages"]["Row"]

/** Validade padrão do link do paciente. */
export const INVITE_TTL_HOURS = 24
/** Teto do chat, conferido no servidor além do CHECK da tabela. */
export const MESSAGE_MAX_LENGTH = 2000

/**
 * O token do convite: 32 bytes (256 bits) de aleatoriedade real.
 *
 * A spec pede ≥128 bits; 256 custa o mesmo e tira a discussão. É `base64url` porque o token
 * vai dentro de uma URL que o paciente recebe por WhatsApp — sem `+`, `/` ou `=` para
 * quebrar no caminho.
 */
function generateInviteToken(): string {
  return randomBytes(32).toString("base64url")
}

/** Só o hash é gravado. Um dump da tabela não abre a consulta de ninguém. */
function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/**
 * Comparação em tempo constante.
 *
 * A busca em si é por igualdade de hash no banco, que já não vaza tempo útil; isto protege
 * o caminho em que o hash volta e é conferido em memória. Barato o bastante para não
 * precisar justificar a exceção.
 */
function hashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex")
  const bufB = Buffer.from(b, "hex")
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

// ---------------------------------------------------------------------------
// Chamadas
// ---------------------------------------------------------------------------

/**
 * Abre a teleconsulta do atendimento em curso.
 *
 * Idempotente de propósito: reabrir a tela devolve a MESMA sala, em vez de criar uma
 * segunda e deixar profissional e paciente em consultas diferentes. Um índice único
 * parcial (migration 026) sustenta isso mesmo sob duas requisições simultâneas — esta
 * leitura é a conveniência, o índice é a garantia.
 */
export async function openCallForServiceEntry(
  supabase: DB,
  clinicId: string,
  input: { queueEntryId: string; createdBy: string }
): Promise<VideoCall> {
  const { data: existing, error: findError } = await supabase
    .from("video_calls")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("queue_entry_id", input.queueEntryId)
    .in("status", ["aguardando", "em_andamento"])
    .maybeSingle()
  if (findError) throw findError
  if (existing) return existing

  const { data, error } = await supabase
    .from("video_calls")
    .insert({
      clinic_id: clinicId,
      queue_entry_id: input.queueEntryId,
      created_by: input.createdBy,
    })
    .select("*")
    .single()
  if (error) throw error
  return data
}

export async function getCall(
  supabase: DB,
  clinicId: string,
  callId: string
): Promise<VideoCall | null> {
  const { data, error } = await supabase
    .from("video_calls")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("id", callId)
    .maybeSingle()
  if (error) throw error
  return data
}

/** As chamadas de um atendimento, para o histórico na ficha. */
export async function listCallsForServiceEntry(
  supabase: DB,
  clinicId: string,
  queueEntryId: string
): Promise<VideoCall[]> {
  const { data, error } = await supabase
    .from("video_calls")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("queue_entry_id", queueEntryId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

/**
 * A sala viva deste atendimento, se houver. É o que a tela lê ao abrir, para mostrar o
 * link já gerado em vez de oferecer "iniciar" a quem já iniciou.
 */
export async function getLiveCallForServiceEntry(
  supabase: DB,
  clinicId: string,
  queueEntryId: string
): Promise<VideoCall | null> {
  const { data, error } = await supabase
    .from("video_calls")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("queue_entry_id", queueEntryId)
    .in("status", ["aguardando", "em_andamento"])
    .maybeSingle()
  if (error) throw error
  return data
}

export async function setCallStatus(
  supabase: DB,
  clinicId: string,
  callId: string,
  status: VideoCallStatus,
  timestamps: { startedAt?: string; endedAt?: string } = {}
): Promise<void> {
  const patch: Database["public"]["Tables"]["video_calls"]["Update"] = { status }
  if (timestamps.startedAt) patch.started_at = timestamps.startedAt
  if (timestamps.endedAt) patch.ended_at = timestamps.endedAt

  const { error } = await supabase
    .from("video_calls")
    .update(patch)
    .eq("clinic_id", clinicId)
    .eq("id", callId)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Convites
// ---------------------------------------------------------------------------

/**
 * Gera o link do paciente.
 *
 * Devolve o token EM CLARO uma única vez — é o único momento em que ele existe fora do
 * hash. Quem chamou entrega ao operador; o banco nunca mais consegue reproduzi-lo.
 */
export async function createInvite(
  supabase: DB,
  clinicId: string,
  input: { callId: string; displayName: string; createdBy: string; ttlHours?: number }
): Promise<{ token: string; expiresAt: string }> {
  const token = generateInviteToken()
  const expiresAt = new Date(
    Date.now() + (input.ttlHours ?? INVITE_TTL_HOURS) * 3600_000
  ).toISOString()

  const { error } = await supabase.from("video_call_invites").insert({
    clinic_id: clinicId,
    call_id: input.callId,
    token_hash: hashInviteToken(token),
    display_name: input.displayName,
    expires_at: expiresAt,
    created_by: input.createdBy,
  })
  if (error) throw error

  return { token, expiresAt }
}

export type InviteResolution =
  | { ok: true; inviteId: string; callId: string; clinicId: string; displayName: string; roomName: string }
  | { ok: false; reason: "not_found" | "expired" | "revoked" | "call_ended" }

/**
 * Resolve o token do link em uma consulta — ou explica por que não.
 *
 * Roda com a service role: o paciente não tem sessão no Supabase, então nenhuma policy o
 * cobre. Toda a autorização dele é isto aqui, e é por isso que cada motivo de recusa é
 * separado: a tela precisa dizer "o link expirou" em vez de "erro", e o servidor precisa
 * recusar sem emitir token em qualquer um dos casos.
 */
export async function resolveInvite(
  admin: DB,
  token: string
): Promise<InviteResolution> {
  const hash = hashInviteToken(token)

  const { data: invite, error } = await admin
    .from("video_call_invites")
    .select("id, clinic_id, call_id, display_name, token_hash, expires_at, revoked_at")
    .eq("token_hash", hash)
    .maybeSingle()
  if (error) throw error
  if (!invite || !hashesMatch(invite.token_hash, hash)) return { ok: false, reason: "not_found" }
  if (invite.revoked_at) return { ok: false, reason: "revoked" }
  if (new Date(invite.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" }

  const { data: call, error: callError } = await admin
    .from("video_calls")
    .select("id, room_name, status")
    .eq("id", invite.call_id)
    .maybeSingle()
  if (callError) throw callError
  if (!call) return { ok: false, reason: "not_found" }
  if (call.status === "encerrada" || call.status === "cancelada") {
    return { ok: false, reason: "call_ended" }
  }

  return {
    ok: true,
    inviteId: invite.id,
    callId: invite.call_id,
    clinicId: invite.clinic_id,
    displayName: invite.display_name,
    roomName: call.room_name,
  }
}

/** Marca o primeiro uso — não invalida, só registra quando o paciente entrou. */
export async function markInviteUsed(admin: DB, inviteId: string): Promise<void> {
  const { error } = await admin
    .from("video_call_invites")
    .update({ used_at: new Date().toISOString() })
    .eq("id", inviteId)
    .is("used_at", null)
  if (error) throw error
}

export async function revokeInvitesForCall(
  supabase: DB,
  clinicId: string,
  callId: string
): Promise<void> {
  const { error } = await supabase
    .from("video_call_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("clinic_id", clinicId)
    .eq("call_id", callId)
    .is("revoked_at", null)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export async function listMessages(
  supabase: DB,
  clinicId: string,
  callId: string
): Promise<VideoCallMessage[]> {
  const { data, error } = await supabase
    .from("video_call_messages")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("call_id", callId)
    .order("sent_at", { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function appendMessage(
  supabase: DB,
  clinicId: string,
  input: { callId: string; senderIdentity: string; senderName: string; body: string }
): Promise<VideoCallMessage> {
  const body = input.body.trim()
  if (!body) throw new Error("Mensagem vazia.")
  if (body.length > MESSAGE_MAX_LENGTH) {
    throw new Error(`Mensagem acima de ${MESSAGE_MAX_LENGTH} caracteres.`)
  }

  const { data, error } = await supabase
    .from("video_call_messages")
    .insert({
      clinic_id: clinicId,
      call_id: input.callId,
      sender_identity: input.senderIdentity,
      sender_name: input.senderName,
      body,
    })
    .select("*")
    .single()
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Participantes (escrito pelo webhook)
// ---------------------------------------------------------------------------

export async function recordParticipantJoined(
  admin: DB,
  input: {
    clinicId: string
    callId: string
    identity: string
    displayName: string | null
    papel: VideoCallRole
    joinedAt: string
  }
): Promise<void> {
  // O índice único parcial (call_id, identity) where left_at is null impede duas entradas
  // abertas para a mesma pessoa quando o LiveKit reenvia o evento.
  const { error } = await admin.from("video_call_participants").insert({
    clinic_id: input.clinicId,
    call_id: input.callId,
    identity: input.identity,
    display_name: input.displayName,
    papel: input.papel,
    joined_at: input.joinedAt,
  })
  if (error && error.code !== "23505") throw error
}

export async function recordParticipantLeft(
  admin: DB,
  input: { callId: string; identity: string; leftAt: string }
): Promise<void> {
  const { error } = await admin
    .from("video_call_participants")
    .update({ left_at: input.leftAt })
    .eq("call_id", input.callId)
    .eq("identity", input.identity)
    .is("left_at", null)
  if (error) throw error
}

export async function listParticipants(
  supabase: DB,
  clinicId: string,
  callId: string
) {
  const { data, error } = await supabase
    .from("video_call_participants")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("call_id", callId)
    .order("joined_at", { ascending: true })
  if (error) throw error
  return data ?? []
}

/** A chamada de um `room_name`, para o webhook — que só conhece a sala. */
export async function getCallByRoomName(admin: DB, roomName: string) {
  const { data, error } = await admin
    .from("video_calls")
    .select("id, clinic_id, status")
    .eq("room_name", roomName)
    .maybeSingle()
  if (error) throw error
  return data
}
