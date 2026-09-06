"use server"

import { revalidatePath } from "next/cache"

import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { describeDbError } from "@/lib/db-errors"
import { recordAudit } from "@/services/audit.service"
import { getAppointment } from "@/services/scheduling.service"
import { isLiveKitConfigured } from "@/lib/livekit/env"
import { closeRoom, issueAccessToken } from "@/lib/livekit/livekit.service"
import { chatMessageSchema, createInviteSchema } from "@/schemas/telehealth.schema"
import {
  appendMessage,
  createInvite,
  getCall,
  listMessages,
  openCallForAppointment,
  revokeInvitesForCall,
  setCallStatus,
} from "@/services/telehealth.service"

export type TelehealthActionState = { error?: string; success?: boolean }

const SEM_CREDENCIAL =
  "Teleconsulta indisponível: as credenciais do LiveKit não estão configuradas neste ambiente."

/**
 * Abre (ou reabre) a sala de um agendamento.
 *
 * A permissão é conferida aqui e o agendamento é lido com o cliente da SESSÃO — se ele não
 * pertencer à clínica de quem chamou, a RLS devolve nada e a ação para. É esse par que
 * substitui a checagem de "tem permissão sobre aquele atendimento" da spec: no CSIB o
 * escopo é a clínica, e é a RLS que o garante, não um `if`.
 */
export async function openCallAction(
  appointmentId: string
): Promise<TelehealthActionState & { callId?: string }> {
  const membership = await requirePermission(PERMISSIONS.TELEHEALTH_MANAGE)
  if (!isLiveKitConfigured()) return { error: SEM_CREDENCIAL }

  const supabase = await createClient()
  try {
    const appointment = await getAppointment(supabase, membership.clinicId, appointmentId)
    if (!appointment) return { error: "Agendamento não encontrado." }

    const call = await openCallForAppointment(supabase, membership.clinicId, {
      appointmentId,
      createdBy: membership.userId,
    })

    await recordAudit({
      clinicId: membership.clinicId,
      userId: membership.userId,
      action: "telehealth.call.open",
      entityType: "video_call",
      entityId: call.id,
      after: { appointmentId, status: call.status },
    })

    revalidatePath("/recepcao/agenda")
    revalidatePath("/profissional/agenda")
    return { success: true, callId: call.id }
  } catch (err) {
    return { error: describeDbError(err) }
  }
}

/**
 * Gera o link do paciente.
 *
 * Devolve a URL montada com o token em claro — a única vez que ele existe fora do hash.
 * A partir daqui só o operador tem como recuperá-lo; perdido, gera-se outro.
 */
export async function createInviteAction(
  callId: string,
  formData: FormData
): Promise<TelehealthActionState & { url?: string; expiresAt?: string }> {
  const membership = await requirePermission(PERMISSIONS.TELEHEALTH_MANAGE)

  const parsed = createInviteSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createClient()
  try {
    const call = await getCall(supabase, membership.clinicId, callId)
    if (!call) return { error: "Chamada não encontrada." }
    if (call.status === "encerrada" || call.status === "cancelada") {
      return { error: "Esta chamada já foi encerrada." }
    }

    const { token, expiresAt } = await createInvite(supabase, membership.clinicId, {
      callId,
      displayName: parsed.data.display_name,
      createdBy: membership.userId,
      ttlHours: parsed.data.ttl_hours,
    })

    await recordAudit({
      clinicId: membership.clinicId,
      userId: membership.userId,
      action: "telehealth.invite.create",
      entityType: "video_call",
      entityId: callId,
      // O token NUNCA vai para a auditoria — quem lê a trilha entraria na consulta.
      after: { displayName: parsed.data.display_name, expiresAt },
    })

    return { success: true, url: `/c/${token}`, expiresAt }
  } catch (err) {
    return { error: describeDbError(err) }
  }
}

/** Token do atendente. Identidade derivada do usuário logado, nunca de input. */
export async function issueProfessionalTokenAction(
  callId: string
): Promise<TelehealthActionState & { token?: string; roomName?: string; serverUrl?: string }> {
  const membership = await requirePermission(PERMISSIONS.TELEHEALTH_MANAGE)
  if (!isLiveKitConfigured()) return { error: SEM_CREDENCIAL }

  const supabase = await createClient()
  try {
    const call = await getCall(supabase, membership.clinicId, callId)
    if (!call) return { error: "Chamada não encontrada." }
    if (call.status === "encerrada" || call.status === "cancelada") {
      return { error: "Esta chamada já foi encerrada." }
    }

    const token = await issueAccessToken({
      roomName: call.room_name,
      identity: `user:${membership.userId}`,
      displayName: membership.fullName,
      role: "atendente",
    })

    const { livekitPublicUrl } = await import("@/lib/livekit/env")
    return { success: true, token, roomName: call.room_name, serverUrl: livekitPublicUrl() ?? undefined }
  } catch (err) {
    return { error: describeDbError(err) }
  }
}

/** Histórico do chat, para o atendente. O paciente lê pelo endpoint público do convite. */
export async function listMessagesAction(callId: string) {
  const membership = await requirePermission(PERMISSIONS.TELEHEALTH_VIEW)
  const supabase = await createClient()
  return listMessages(supabase, membership.clinicId, callId)
}

/** Persiste uma mensagem enviada pelo atendente. */
export async function sendMessageAction(
  callId: string,
  body: string
): Promise<TelehealthActionState> {
  const membership = await requirePermission(PERMISSIONS.TELEHEALTH_MANAGE)

  const parsed = chatMessageSchema.safeParse({ body })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Mensagem inválida" }
  }

  const supabase = await createClient()
  try {
    const call = await getCall(supabase, membership.clinicId, callId)
    if (!call) return { error: "Chamada não encontrada." }

    await appendMessage(supabase, membership.clinicId, {
      callId,
      senderIdentity: `user:${membership.userId}`,
      senderName: membership.fullName,
      body: parsed.data.body,
    })
    return { success: true }
  } catch (err) {
    return { error: describeDbError(err) }
  }
}

/**
 * Encerra a consulta.
 *
 * Três coisas, nesta ordem: derruba a sala no LiveKit (é o que efetivamente desconecta as
 * duas pontas), revoga os convites (o link não pode ressuscitar a sessão) e grava o
 * desfecho. O `ended_at` também chega pelo webhook `room_finished`; gravar aqui é o que
 * mantém a tela correta quando o webhook ainda não foi configurado no painel.
 */
export async function endCallAction(callId: string): Promise<TelehealthActionState> {
  const membership = await requirePermission(PERMISSIONS.TELEHEALTH_MANAGE)
  const supabase = await createClient()

  try {
    const call = await getCall(supabase, membership.clinicId, callId)
    if (!call) return { error: "Chamada não encontrada." }

    if (isLiveKitConfigured()) await closeRoom(call.room_name)
    await revokeInvitesForCall(supabase, membership.clinicId, callId)
    await setCallStatus(supabase, membership.clinicId, callId, "encerrada", {
      endedAt: new Date().toISOString(),
    })

    await recordAudit({
      clinicId: membership.clinicId,
      userId: membership.userId,
      action: "telehealth.call.end",
      entityType: "video_call",
      entityId: callId,
      before: { status: call.status },
      after: { status: "encerrada" },
    })

    revalidatePath("/recepcao/agenda")
    revalidatePath("/profissional/agenda")
    return { success: true }
  } catch (err) {
    return { error: describeDbError(err) }
  }
}
