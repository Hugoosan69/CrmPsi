import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { ConversationKind, Database } from "@/types/supabase"
import { createAdminClient } from "@/lib/supabase/admin"
import { pendingMigrationFor } from "@/lib/db-errors"

type DB = SupabaseClient<Database>

export type Conversation = Database["public"]["Tables"]["conversations"]["Row"]
export type InternalMessage = Database["public"]["Tables"]["internal_messages"]["Row"]

export type ConversationView = {
  id: string
  kind: ConversationKind
  /** Group title, or the other person's name for a direct thread. */
  title: string
  participantIds: string[]
  lastMessageAt: string | null
  lastMessagePreview: string | null
  unreadCount: number
}

export type MessageView = InternalMessage & {
  senderName: string
  isMine: boolean
}

/**
 * Whether the chat tables exist yet. An un-migrated database would otherwise render an
 * empty conversation list, which reads as "nobody has messaged you" rather than "this
 * feature is not installed" — two very different things to show an operator.
 */
export async function chatSchemaStatus(
  supabase: DB
): Promise<{ ready: true } | { ready: false; migration: string }> {
  const { error } = await supabase.from("conversations").select("id").limit(1)
  if (!error) return { ready: true }

  const migration = pendingMigrationFor(error)
  if (migration) return { ready: false, migration }
  throw error
}

/** Deterministic key for a one-to-one thread, so "open the DM with X" is idempotent. */
export function directKey(a: string, b: string) {
  return [a, b].sort().join(":")
}

/**
 * Staff a user may start a conversation with: active members of the same clinic. Chat is
 * scoped to the clinic even though the messages themselves are scoped to participation.
 */
export async function listChatContacts(supabase: DB, clinicId: string, exceptUserId: string) {
  const { data: memberships, error } = await supabase
    .from("clinic_memberships")
    .select("user_id, role_id")
    .eq("clinic_id", clinicId)
    .eq("active", true)
  if (error) throw error

  const userIds = (memberships ?? []).map((m) => m.user_id).filter((id) => id !== exceptUserId)
  if (userIds.length === 0) return []

  const [{ data: profiles, error: profileError }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").in("id", userIds).eq("active", true),
    supabase.from("roles").select("id, name"),
  ])
  if (profileError) throw profileError

  const roleName = new Map((roles ?? []).map((r) => [r.id, r.name]))
  const roleByUser = new Map((memberships ?? []).map((m) => [m.user_id, m.role_id]))

  return (profiles ?? [])
    .map((profile) => ({
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      roleName: roleName.get(roleByUser.get(profile.id) ?? "") ?? null,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"))
}

export async function listConversations(
  supabase: DB,
  userId: string
): Promise<ConversationView[]> {
  try {
    // RLS restricts conversations to threads the caller participates in, so this needs no
    // explicit filter — but the participant rows are what carry `last_read_at`.
    const { data: myParticipations, error: participationError } = await supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", userId)
    if (participationError) throw participationError

    const conversationIds = (myParticipations ?? []).map((p) => p.conversation_id)
    if (conversationIds.length === 0) return []

    const [{ data: conversations, error: convError }, { data: allParticipants }, { data: recentMessages }] =
      await Promise.all([
        supabase
          .from("conversations")
          .select("*")
          .in("id", conversationIds)
          .order("last_message_at", { ascending: false, nullsFirst: false }),
        supabase
          .from("conversation_participants")
          .select("conversation_id, user_id")
          .in("conversation_id", conversationIds),
        supabase
          .from("internal_messages")
          .select("conversation_id, body, created_at, deleted_at")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false }),
      ])
    if (convError) throw convError

    const participantIds = new Map<string, string[]>()
    for (const row of allParticipants ?? []) {
      const list = participantIds.get(row.conversation_id) ?? []
      list.push(row.user_id)
      participantIds.set(row.conversation_id, list)
    }

    const otherIds = [
      ...new Set((allParticipants ?? []).map((p) => p.user_id).filter((id) => id !== userId)),
    ]
    const { data: profiles } = otherIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", otherIds)
      : { data: [] as { id: string; full_name: string }[] }
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]))

    const lastReadBy = new Map(
      (myParticipations ?? []).map((p) => [p.conversation_id, p.last_read_at])
    )

    // One pass over messages ordered newest-first gives both the preview and the unread
    // count without a query per conversation.
    const preview = new Map<string, string>()
    const unread = new Map<string, number>()
    for (const message of recentMessages ?? []) {
      if (!preview.has(message.conversation_id)) {
        preview.set(
          message.conversation_id,
          message.deleted_at ? "Mensagem apagada" : message.body.slice(0, 120)
        )
      }
      const lastRead = lastReadBy.get(message.conversation_id)
      if (!message.deleted_at && (!lastRead || message.created_at > lastRead)) {
        unread.set(message.conversation_id, (unread.get(message.conversation_id) ?? 0) + 1)
      }
    }

    return (conversations ?? []).map((conversation) => {
      const ids = participantIds.get(conversation.id) ?? []
      const others = ids.filter((id) => id !== userId)
      const title =
        conversation.kind === "group"
          ? conversation.title ?? "Grupo"
          : nameById.get(others[0] ?? "") ?? "Conversa"

      return {
        id: conversation.id,
        kind: conversation.kind,
        title,
        participantIds: ids,
        lastMessageAt: conversation.last_message_at,
        lastMessagePreview: preview.get(conversation.id) ?? null,
        unreadCount: unread.get(conversation.id) ?? 0,
      }
    })
  } catch (err) {
    if (pendingMigrationFor(err)) return []
    throw err
  }
}

export async function countUnreadMessages(supabase: DB, userId: string): Promise<number> {
  const conversations = await listConversations(supabase, userId)
  return conversations.reduce((sum, c) => sum + c.unreadCount, 0)
}

export async function listMessages(
  supabase: DB,
  conversationId: string,
  userId: string,
  limit = 200
): Promise<MessageView[]> {
  const { data, error } = await supabase
    .from("internal_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw error

  const messages = (data ?? []).slice().reverse()
  const senderIds = [...new Set(messages.map((m) => m.sender_id))]
  const { data: profiles } = senderIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", senderIds)
    : { data: [] as { id: string; full_name: string }[] }
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]))

  return messages.map((message) => ({
    ...message,
    senderName: nameById.get(message.sender_id) ?? "—",
    isMine: message.sender_id === userId,
  }))
}

export async function getConversationParticipants(supabase: DB, conversationId: string) {
  const { data, error } = await supabase
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
  if (error) throw error
  return (data ?? []).map((row) => row.user_id)
}

/**
 * Creating a thread is two writes (the row, then its participants) and the first
 * participant cannot satisfy a participation check, so migration 004 gives these tables no
 * client insert policy and this goes through the service-role client. The caller must
 * already have verified that every participant belongs to `clinicId`.
 */
export async function createConversation(
  input: {
    clinicId: string
    kind: ConversationKind
    title: string | null
    createdBy: string
    participantIds: string[]
  }
): Promise<string> {
  const admin = createAdminClient()
  const participants = [...new Set([input.createdBy, ...input.participantIds])]

  const key =
    input.kind === "direct" && participants.length === 2
      ? directKey(participants[0], participants[1])
      : null

  if (key) {
    // Reuse rather than accumulate duplicate one-to-one threads.
    const { data: existing } = await admin
      .from("conversations")
      .select("id")
      .eq("clinic_id", input.clinicId)
      .eq("direct_key", key)
      .maybeSingle()
    if (existing) return existing.id
  }

  const { data: conversation, error } = await admin
    .from("conversations")
    .insert({
      clinic_id: input.clinicId,
      kind: input.kind,
      title: input.title,
      direct_key: key,
      created_by: input.createdBy,
    })
    .select("id")
    .single()
  if (error) throw error

  const { error: participantError } = await admin.from("conversation_participants").insert(
    participants.map((userId) => ({ conversation_id: conversation.id, user_id: userId }))
  )
  if (participantError) throw participantError

  return conversation.id
}

export async function sendInternalMessage(
  supabase: DB,
  input: { conversationId: string; clinicId: string; senderId: string; body: string }
): Promise<string> {
  const { data, error } = await supabase
    .from("internal_messages")
    .insert({
      conversation_id: input.conversationId,
      clinic_id: input.clinicId,
      sender_id: input.senderId,
      body: input.body,
    })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

export async function markConversationRead(supabase: DB, conversationId: string, userId: string) {
  const { error } = await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
  if (error) throw error
}

/** Soft delete — a retracted message leaves a visible gap instead of rewriting history. */
export async function retractMessage(supabase: DB, messageId: string, senderId: string) {
  const { data, error } = await supabase
    .from("internal_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("sender_id", senderId)
    .is("deleted_at", null)
    .select("id")
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error("Só o autor pode apagar a mensagem, e apenas uma vez.")
  }
}
