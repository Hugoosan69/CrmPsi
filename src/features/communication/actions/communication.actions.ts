"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import { messageTemplateSchema, sendMessageSchema } from "@/schemas/communication.schema"
import {
  createMessageTemplate,
  sendMessage,
  setMessageTemplateActive,
  updateMessageTemplate,
} from "@/services/communication.service"
import { recordAudit } from "@/services/audit.service"

export type CommunicationActionState = { error?: string; success?: boolean }

export async function createMessageTemplateAction(
  _prev: CommunicationActionState,
  formData: FormData
): Promise<CommunicationActionState> {
  const membership = await requirePermission(PERMISSIONS.COMMUNICATION_MANAGE)

  const parsed = messageTemplateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createClient()
  await createMessageTemplate(supabase, membership.clinicId, parsed.data)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "message_template.create",
    entityType: "message_template",
    after: parsed.data,
  })

  revalidatePath("/gestao/comunicacao")
  return { success: true }
}

export async function updateMessageTemplateAction(
  templateId: string,
  _prev: CommunicationActionState,
  formData: FormData
): Promise<CommunicationActionState> {
  const membership = await requirePermission(PERMISSIONS.COMMUNICATION_MANAGE)

  const parsed = messageTemplateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createClient()
  await updateMessageTemplate(supabase, templateId, parsed.data)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "message_template.update",
    entityType: "message_template",
    entityId: templateId,
    after: parsed.data,
  })

  revalidatePath("/gestao/comunicacao")
  return { success: true }
}

export async function setMessageTemplateActiveAction(templateId: string, active: boolean) {
  const membership = await requirePermission(PERMISSIONS.COMMUNICATION_MANAGE)

  const supabase = await createClient()
  await setMessageTemplateActive(supabase, templateId, active)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: active ? "message_template.activate" : "message_template.deactivate",
    entityType: "message_template",
    entityId: templateId,
  })

  revalidatePath("/gestao/comunicacao")
}

export async function sendMessageAction(
  context: { patientId: string; templateId: string | null },
  _prev: CommunicationActionState,
  formData: FormData
): Promise<CommunicationActionState> {
  const membership = await requirePermission(PERMISSIONS.PATIENTS_MANAGE)

  const parsed = sendMessageSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createClient()
  const result = await sendMessage(supabase, membership.clinicId, {
    patientId: context.patientId,
    templateId: context.templateId,
    channel: parsed.data.channel,
    type: parsed.data.type,
    subject: parsed.data.subject,
    body: parsed.data.body,
  })

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "message.send",
    entityType: "message",
    entityId: result.messageId,
    after: { channel: parsed.data.channel, type: parsed.data.type, status: result.status },
  })

  revalidatePath(`/recepcao/pacientes/${context.patientId}`)
  revalidatePath(`/profissional/pacientes/${context.patientId}`)

  if (result.status === "skipped") {
    return { error: "Paciente sem contato cadastrado para esse canal — mensagem registrada como não enviada." }
  }
  return { success: true }
}
