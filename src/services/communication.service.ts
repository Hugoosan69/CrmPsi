import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Json, MessageChannel, MessageType } from "@/types/supabase"
import {
  getN8nIntegration,
  n8nWebhookUrl,
  type N8nIntegration,
} from "./clinic-settings.service"

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

/**
 * Posts each message to an n8n webhook and lets the workflow own the vendor side. n8n
 * holds the WhatsApp/SMS/e-mail credentials, so none of them live in this codebase, and
 * the clinic can change channel behaviour without a deploy.
 *
 * A non-2xx response or a network failure is recorded as `failed` with the body attached
 * rather than thrown — sendMessage's contract is that the `messages` row always ends up
 * reflecting what actually happened.
 */
class N8nProvider implements MessageProvider {
  constructor(
    private readonly config: { webhookUrl: string; secret: string | null },
    private readonly context: { clinicId: string; type: MessageType; patientId: string }
  ) {}

  async send(input: { to: string; channel: MessageChannel; subject: string | null; body: string }) {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (this.config.secret) headers["X-CSIB-Token"] = this.config.secret

    try {
      const response = await fetch(this.config.webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          clinicId: this.context.clinicId,
          patientId: this.context.patientId,
          type: this.context.type,
          channel: input.channel,
          to: input.to,
          subject: input.subject,
          body: input.body,
          requestedAt: new Date().toISOString(),
        }),
        // A slow workflow must not hold a Server Action open indefinitely.
        signal: AbortSignal.timeout(15_000),
      })

      const text = await response.text()
      if (!response.ok) {
        return {
          status: "failed" as const,
          providerResponse: { provider: "n8n", httpStatus: response.status, body: text.slice(0, 1000) },
        }
      }

      return {
        status: "sent" as const,
        providerResponse: {
          provider: "n8n",
          httpStatus: response.status,
          body: text.slice(0, 1000),
          sentAt: new Date().toISOString(),
        },
      }
    } catch (err) {
      return {
        status: "failed" as const,
        providerResponse: {
          provider: "n8n",
          error: err instanceof Error ? err.message : "erro desconhecido",
        },
      }
    }
  }
}

function getProvider(
  channel: MessageChannel,
  n8n: N8nIntegration,
  context: { clinicId: string; type: MessageType; patientId: string }
): MessageProvider {
  // Derivado de servidor + caminho, com a URL completa antiga como fallback — sem isto uma
  // integração salva no formato novo teria webhookUrl vazio e cairia calada no provider de
  // console, ou seja, nenhuma mensagem sairia e nada indicaria o porquê.
  const target = n8nWebhookUrl(n8n)
  if (n8n.enabled && target && n8n.channels.includes(channel)) {
    return new N8nProvider({ webhookUrl: target, secret: n8n.secret }, context)
  }
  // Console remains the fallback for channels the clinic has not routed to n8n, so an
  // unconfigured channel is visibly simulated rather than silently dropped.
  return new ConsoleProvider()
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

  const n8n = await getN8nIntegration(supabase, clinicId)
  const provider = getProvider(input.channel, n8n, {
    clinicId,
    type: input.type,
    patientId: input.patientId,
  })
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
