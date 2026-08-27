"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { requireMembership } from "@/lib/auth/session"
import {
  countUnreadMessages,
  createConversation,
  getConversationParticipants,
  listConversations,
  listMessages,
  markConversationRead,
  retractMessage,
  sendInternalMessage,
} from "@/services/internal-chat.service"
import { notify } from "@/services/notifications.service"
import { recordAudit } from "@/services/audit.service"
import { describeDbError } from "@/lib/db-errors"

export type ChatActionState = { error?: string; success?: boolean; conversationId?: string }

/**
 * Internal chat is available to anyone with an active membership — it is the staff's own
 * communication channel, not a permissioned module. Message *visibility* is enforced by
 * participation in RLS (database/migrations/004), not by a permission slug.
 */
async function requireChatAccess() {
  return requireMembership()
}

function revalidateChat() {
  revalidatePath("/mensagens")
}

export async function listConversationsAction() {
  const membership = await requireChatAccess()
  const supabase = await createClient()
  return listConversations(supabase, membership.userId)
}

export async function listMessagesAction(conversationId: string) {
  const membership = await requireChatAccess()
  const supabase = await createClient()

  // RLS would already refuse a thread the caller is not in, but an explicit check gives a
  // readable message instead of an empty list that looks like "no messages yet".
  const participants = await getConversationParticipants(supabase, conversationId)
  if (!participants.includes(membership.userId)) {
    throw new Error("Você não participa desta conversa.")
  }

  return listMessages(supabase, conversationId, membership.userId)
}

export async function unreadMessageCountAction() {
  const membership = await requireChatAccess()
  const supabase = await createClient()
  return countUnreadMessages(supabase, membership.userId)
}

export async function openDirectConversationAction(otherUserId: string): Promise<ChatActionState> {
  const membership = await requireChatAccess()
  const supabase = await createClient()

  if (otherUserId === membership.userId) {
    return { error: "Escolha outra pessoa para conversar." }
  }

  // The service layer writes with the service-role client, so tenant membership has to be
  // proven here — the database will not do it for us on that path.
  const { data: target, error } = await supabase
    .from("clinic_memberships")
    .select("user_id")
    .eq("clinic_id", membership.clinicId)
    .eq("user_id", otherUserId)
    .eq("active", true)
    .maybeSingle()
  if (error) return { error: describeDbError(error) }
  if (!target) return { error: "Esta pessoa não é membro ativo da clínica." }

  try {
    const conversationId = await createConversation({
      clinicId: membership.clinicId,
      kind: "direct",
      title: null,
      createdBy: membership.userId,
      participantIds: [otherUserId],
    })
    revalidateChat()
    return { success: true, conversationId }
  } catch (err) {
    return { error: describeDbError(err) }
  }
}

export async function createGroupConversationAction(
  _prev: ChatActionState,
  formData: FormData
): Promise<ChatActionState> {
  const membership = await requireChatAccess()
  const supabase = await createClient()

  const title = String(formData.get("title") ?? "").trim()
  const participantIds = formData.getAll("participants").map(String).filter(Boolean)

  if (!title) return { error: "Dê um nome ao grupo." }
  if (participantIds.length === 0) return { error: "Selecione ao menos uma pessoa." }

  const { data: members, error } = await supabase
    .from("clinic_memberships")
    .select("user_id")
    .eq("clinic_id", membership.clinicId)
    .eq("active", true)
    .in("user_id", participantIds)
  if (error) return { error: describeDbError(error) }

  const valid = (members ?? []).map((m) => m.user_id)
  if (valid.length !== participantIds.length) {
    return { error: "Alguma das pessoas selecionadas não é membro ativo da clínica." }
  }

  try {
    const conversationId = await createConversation({
      clinicId: membership.clinicId,
      kind: "group",
      title,
      createdBy: membership.userId,
      participantIds: valid,
    })

    await notify({
      clinicId: membership.clinicId,
      userIds: valid,
      kind: "chat",
      title: `Você foi adicionado ao grupo "${title}"`,
      body: `${membership.fullName} criou o grupo.`,
      href: `/mensagens?conversa=${conversationId}`,
      entityType: "conversation",
      entityId: conversationId,
      exceptUserId: membership.userId,
    })

    revalidateChat()
    return { success: true, conversationId }
  } catch (err) {
    return { error: describeDbError(err) }
  }
}

export async function sendMessageAction(
  conversationId: string,
  body: string
): Promise<ChatActionState> {
  const membership = await requireChatAccess()
  const supabase = await createClient()

  const text = body.trim()
  if (!text) return { error: "Escreva uma mensagem." }
  if (text.length > 4000) return { error: "Mensagem muito longa (limite de 4000 caracteres)." }

  const participants = await getConversationParticipants(supabase, conversationId)
  if (!participants.includes(membership.userId)) {
    return { error: "Você não participa desta conversa." }
  }

  try {
    await sendInternalMessage(supabase, {
      conversationId,
      clinicId: membership.clinicId,
      senderId: membership.userId,
      body: text,
    })
  } catch (err) {
    return { error: describeDbError(err) }
  }

  // Sending also marks the thread read for the sender — otherwise your own message
  // would count against your unread badge.
  await markConversationRead(supabase, conversationId, membership.userId)

  await notify({
    clinicId: membership.clinicId,
    userIds: participants,
    kind: "chat",
    title: `Nova mensagem de ${membership.fullName}`,
    body: text.slice(0, 140),
    href: `/mensagens?conversa=${conversationId}`,
    entityType: "conversation",
    entityId: conversationId,
    exceptUserId: membership.userId,
  })

  revalidateChat()
  return { success: true, conversationId }
}

export async function markConversationReadAction(conversationId: string) {
  const membership = await requireChatAccess()
  const supabase = await createClient()
  await markConversationRead(supabase, conversationId, membership.userId)
  revalidateChat()
}

export async function retractMessageAction(messageId: string) {
  const membership = await requireChatAccess()
  const supabase = await createClient()

  await retractMessage(supabase, messageId, membership.userId)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "chat.retract",
    entityType: "internal_message",
    entityId: messageId,
  })

  revalidateChat()
}
