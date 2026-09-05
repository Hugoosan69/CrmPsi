import "server-only"

import { ACTIVE_APPOINTMENT_STATUSES } from "@/config/agenda"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Json, MessageChannel, MessageType } from "@/types/supabase"
import {
  getN8nIntegration,
  n8nWebhookUrl,
  type N8nIntegration,
} from "./clinic-settings.service"
import { getWahaConfig, sendWahaText, type WahaConfig } from "./waha.service"
import { fetchPage } from "@/lib/paginated-query"

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

/**
 * Envia WhatsApp direto pelo WAHA, sem passar pelo n8n.
 *
 * Existe para o envio imediato — o botão "Enviar mensagem" numa ficha — funcionar sem
 * depender de um workflow externo estar montado e ativo. As mensagens agendadas continuam
 * indo para a fila que o n8n consulta; são caminhos diferentes porque resolvem problemas
 * diferentes: aqui a pessoa está olhando a tela e espera resposta imediata.
 */
class WahaProvider implements MessageProvider {
  constructor(private readonly config: WahaConfig) {}

  async send(input: { to: string; channel: MessageChannel; subject: string | null; body: string }) {
    try {
      const response = await sendWahaText(this.config, input.to, input.body)
      return {
        status: "sent" as const,
        providerResponse: { provider: "waha", body: response.slice(0, 1000) },
      }
    } catch (err) {
      return {
        status: "failed" as const,
        providerResponse: {
          provider: "waha",
          error: err instanceof Error ? err.message : String(err),
        },
      }
    }
  }
}

function getProvider(
  channel: MessageChannel,
  n8n: N8nIntegration,
  context: { clinicId: string; type: MessageType; patientId: string },
  waha?: WahaConfig
): MessageProvider {
  // WAHA primeiro e só para WhatsApp: é o caminho mais curto quando o número da clínica já
  // está pareado, e não depende de o workflow do n8n existir. SMS e e-mail o WAHA não faz.
  if (waha?.enabled && waha.baseUrl && channel === "whatsapp") {
    return new WahaProvider(waha)
  }

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

/**
 * Modelos de mensagem, todos.
 *
 * Sem paginar de propósito: além de virarem tabela na tela de comunicação, são o seletor do
 * painel de automações e do envio avulso na ficha do paciente. Uma clínica tem dezenas, não
 * milhares — paginar aqui esconderia opções de quem está escolhendo uma.
 */
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

  const [n8n, waha] = await Promise.all([
    getN8nIntegration(supabase, clinicId),
    getWahaConfig(supabase, clinicId),
  ])
  const provider = getProvider(
    input.channel,
    n8n,
    { clinicId, type: input.type, patientId: input.patientId },
    waha
  )
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

// ---------------------------------------------------------------------------
// Campanhas e automações (migrations/007)
// ---------------------------------------------------------------------------

export type CampaignAudience = "active" | "inactive" | "all" | "single"
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "cancelled"
  | "failed"

export type Campaign = {
  id: string
  name: string
  channel: MessageChannel
  subject: string | null
  body_template: string
  audience: CampaignAudience
  patient_id: string | null
  scheduled_for: string | null
  status: CampaignStatus
  recipients_count: number
  sent_count: number
  failed_count: number
  created_at: string
}

export async function listCampaigns(
  supabase: DB,
  clinicId: string,
  opts: { offset?: number; rangeEnd?: number } = {}
): Promise<{ rows: Campaign[]; total: number }> {
  const { rows, total } = await fetchPage(
    () =>
      supabase
        .from("message_campaigns")
        .select(
          "id, name, channel, subject, body_template, audience, patient_id, scheduled_for, status, recipients_count, sent_count, failed_count, created_at",
          { count: "exact" }
        )
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false }),
    opts
  )
  return { rows: rows as Campaign[], total }
}

export async function createCampaign(
  supabase: DB,
  clinicId: string,
  userId: string,
  input: {
    name: string
    channel: MessageChannel
    subject: string | null
    body_template: string
    audience: CampaignAudience
    patient_id: string | null
    scheduled_for: string | null
  }
) {
  const { data, error } = await supabase
    .from("message_campaigns")
    .insert({
      ...input,
      clinic_id: clinicId,
      created_by: userId,
      // Sem data marcada a campanha nasce rascunho, para o operador revisar e disparar;
      // com data, já entra na fila. Disparar no momento do cadastro seria irreversível.
      status: input.scheduled_for ? "scheduled" : "draft",
    })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

/** Quantas pessoas a campanha atinge, pela mesma definição que o disparo vai usar. */
export async function countCampaignRecipients(supabase: DB, campaignId: string) {
  const { data, error } = await supabase.rpc("campaign_recipients" as never, {
    p_campaign: campaignId,
  } as never)
  if (error) throw error
  return ((data ?? []) as unknown[]).length
}

export type CampaignRecipient = {
  patient_id: string
  full_name: string
  phone: string | null
  email: string | null
}

export async function listCampaignRecipients(
  supabase: DB,
  campaignId: string
): Promise<CampaignRecipient[]> {
  const { data, error } = await supabase.rpc("campaign_recipients" as never, {
    p_campaign: campaignId,
  } as never)
  if (error) throw error
  return (data ?? []) as unknown as CampaignRecipient[]
}

export async function setCampaignStatus(
  supabase: DB,
  clinicId: string,
  campaignId: string,
  status: CampaignStatus,
  extra: Partial<Pick<Campaign, "recipients_count" | "sent_count" | "failed_count">> = {}
) {
  const { error } = await supabase
    .from("message_campaigns")
    .update({ status, ...extra })
    .eq("id", campaignId)
    .eq("clinic_id", clinicId)
  if (error) throw error
}

export type Automation = {
  id: string
  type: MessageType
  enabled: boolean
  channel: MessageChannel
  template_id: string | null
  offset_minutes: number
  send_at_time: string | null
}

export async function listAutomations(supabase: DB, clinicId: string): Promise<Automation[]> {
  const { data, error } = await supabase
    .from("message_automations")
    .select("id, type, enabled, channel, template_id, offset_minutes, send_at_time")
    .eq("clinic_id", clinicId)
  if (error) throw error
  return (data ?? []) as Automation[]
}

/**
 * Grava a automação de um tipo. Upsert por (clinic_id, type) porque o schema permite
 * exatamente uma por tipo — duas regras de aniversário mandariam a mensagem duas vezes.
 */
export async function saveAutomation(
  supabase: DB,
  clinicId: string,
  input: {
    type: MessageType
    enabled: boolean
    channel: MessageChannel
    template_id: string | null
    offset_minutes: number
    send_at_time: string | null
  }
) {
  const { error } = await supabase
    .from("message_automations")
    .upsert({ ...input, clinic_id: clinicId }, { onConflict: "clinic_id,type" })
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Variáveis com dados reais
// ---------------------------------------------------------------------------

/**
 * Valores das variáveis de mensagem para um paciente.
 *
 * Busca a PRÓXIMA consulta futura, não a mais recente: as variáveis de consulta existem para
 * lembrete e confirmação, e apontá-las para um atendimento que já passou mandaria o paciente
 * comparecer a uma data vencida.
 *
 * Campos ausentes viram string vazia em vez de "null" ou "undefined" — a frase fica
 * incompleta, o que é ruim, mas mandar a palavra "null" para o paciente é pior.
 */
export async function resolveMessageVariables(
  supabase: DB,
  clinicId: string,
  patientId: string,
  clinicName: string
): Promise<Record<string, string>> {
  const [{ data: patient }, { data: appointments }] = await Promise.all([
    supabase
      .from("patients")
      .select("full_name, social_name, phone, whatsapp, email, birth_date")
      .eq("id", patientId)
      .eq("clinic_id", clinicId)
      .maybeSingle(),
    supabase
      .from("appointments")
      .select("scheduled_at, professionals(full_name), procedures(name)")
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .in("status", ACTIVE_APPOINTMENT_STATUSES)
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(1),
  ])

  const name = patient?.social_name || patient?.full_name || ""
  const next = appointments?.[0] as
    | {
        scheduled_at: string
        professionals: { full_name: string } | null
        procedures: { name: string } | null
      }
    | undefined

  // Formatado no fuso da clínica, não em UTC: uma consulta às 08:00 em Brasília gravada
  // como 11:00Z viraria "11:00" na mensagem se formatada crua.
  const when = next ? new Date(next.scheduled_at) : null
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    when
      ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ...opts }).format(when)
      : ""

  return {
    paciente: name,
    primeiro_nome: name.split(" ")[0] ?? "",
    telefone: patient?.whatsapp || patient?.phone || "",
    email: patient?.email || "",
    clinica: clinicName,
    data: fmt({ day: "2-digit", month: "2-digit", year: "numeric" }),
    hora: fmt({ hour: "2-digit", minute: "2-digit" }),
    profissional: next?.professionals?.full_name ?? "",
    procedimento: next?.procedures?.name ?? "",
  }
}

/**
 * Enfileira uma mensagem para o n8n buscar depois, em vez de enviar agora.
 *
 * É o caminho das campanhas agendadas e das automações: o corpo já vai renderizado e o
 * horário fica em scheduled_at, então a varredura do n8n só precisa ler e mandar. Guardar o
 * texto final e não o modelo é o que permite auditar meses depois o que a pessoa recebeu.
 */
export async function queueMessage(
  supabase: DB,
  clinicId: string,
  input: {
    patientId: string
    campaignId: string | null
    templateId: string | null
    channel: MessageChannel
    type: MessageType
    subject: string | null
    body: string
    scheduledAt: string | null
    /** "skipped" grava a linha sem entrar na fila do n8n — serve para registrar por que
     *  alguém não recebeu, em vez de a pessoa sumir do relatório sem explicação. */
    status?: "queued" | "skipped"
    reason?: Json
  }
) {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      clinic_id: clinicId,
      patient_id: input.patientId,
      campaign_id: input.campaignId,
      template_id: input.templateId,
      channel: input.channel,
      type: input.type,
      status: input.status ?? "queued",
      scheduled_at: input.scheduledAt,
      payload: { subject: input.subject, body: input.body },
      provider_response: input.reason ?? null,
    })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}
