import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Json, MessageChannel, MessageType } from "@/types/supabase"

type DB = SupabaseClient<Database>

export type ProviderResult = { status: "sent" | "failed"; providerResponse: Json }

export interface MessageProvider {
  send(input: { to: string; channel: MessageChannel; subject: string | null; body: string }): Promise<ProviderResult>
}

/**
 * Item 21: the send path is provider-agnostic on purpose. This console provider is the
 * only implementation for the MVP — swapping in real WhatsApp/SMS/e-mail vendors later
 * means adding a new class here and pointing getProvider() at it, with no change to
 * message_templates/messages or to anything that calls sendMessage().
 */
class ConsoleProvider implements MessageProvider {
  async send(input: { to: string; channel: MessageChannel; subject: string | null; body: string }) {
    console.log(`[communication:${input.channel}] to=${input.to}`, input.subject ?? "", input.body)
    return { status: "sent" as const, providerResponse: { simulated: true, sentAt: new Date().toISOString() } }
  }
}

function getProvider(channel: MessageChannel): MessageProvider {
  switch (channel) {
    case "whatsapp":
    case "sms":
    case "email":
    default:
      // Each case is where a real vendor integration would plug in later.
      return new ConsoleProvider()
  }
}

function contactFor(
  channel: MessageChannel,
  patient: { phone: string | null; whatsapp: string | null; email: string | null }
) {
  if (channel === "whatsapp") return patient.whatsapp || patient.phone
  if (channel === "sms") return patient.phone
  return patient.email
}

export async function listMessageTemplates(supabase: DB, clinicId: string) {
  const { data, error } = await supabase
    .from("message_templates")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("type")
  if (error) throw error
  return data ?? []
}

export async function createMessageTemplate(
  supabase: DB,
  clinicId: string,
  input: { type: MessageType; channel: MessageChannel; subject: string | null; body_template: string }
) {
  const { error } = await supabase.from("message_templates").insert({ ...input, clinic_id: clinicId })
  if (error) throw error
}

export async function updateMessageTemplate(
  supabase: DB,
  templateId: string,
  input: { type: MessageType; channel: MessageChannel; subject: string | null; body_template: string }
) {
  const { error } = await supabase.from("message_templates").update(input).eq("id", templateId)
  if (error) throw error
}

export async function setMessageTemplateActive(supabase: DB, templateId: string, active: boolean) {
  const { error } = await supabase.from("message_templates").update({ active }).eq("id", templateId)
  if (error) throw error
}

export async function listMessagesForPatient(supabase: DB, clinicId: string, patientId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

/**
 * Always writes a `messages` row first (queued), then attempts the send and updates the
 * same row with the outcome — so a provider failure or missing contact still leaves an
 * auditable record instead of silently doing nothing.
 */
export async function sendMessage(
  supabase: DB,
  clinicId: string,
  input: {
    patientId: string
    templateId: string | null
    channel: MessageChannel
    type: MessageType
    subject: string | null
    body: string
  }
) {
  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      clinic_id: clinicId,
      patient_id: input.patientId,
      template_id: input.templateId,
      channel: input.channel,
      type: input.type,
      status: "queued",
      payload: { subject: input.subject, body: input.body },
    })
    .select("id")
    .single()
  if (error) throw error

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("phone, whatsapp, email")
    .eq("id", input.patientId)
    .single()
  if (patientError) throw patientError

  const to = contactFor(input.channel, patient)
  if (!to) {
    await supabase
      .from("messages")
      .update({ status: "skipped", provider_response: { reason: "missing_contact" } })
      .eq("id", message.id)
    return { messageId: message.id, status: "skipped" as const }
  }

  const provider = getProvider(input.channel)
  const result = await provider.send({ to, channel: input.channel, subject: input.subject, body: input.body })

  await supabase
    .from("messages")
    .update({
      status: result.status,
      sent_at: result.status === "sent" ? new Date().toISOString() : null,
      provider_response: result.providerResponse,
    })
    .eq("id", message.id)

  return { messageId: message.id, status: result.status }
}
