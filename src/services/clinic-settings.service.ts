import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Json, MessageChannel } from "@/types/supabase"
import { pendingMigrationFor } from "@/lib/db-errors"
import { composeWebhookUrls } from "@/config/n8n"

type DB = SupabaseClient<Database>

/**
 * n8n as the messaging gateway: CSIB posts one JSON payload per message to a webhook and
 * n8n owns the vendor side (WhatsApp Cloud API, SMS, e-mail, whatever the clinic wires up).
 * That keeps every provider credential out of this codebase and lets the clinic change
 * channel behaviour without a deploy.
 */
export type N8nIntegration = {
  enabled: boolean
  /** Servidor n8n, sem caminho — ex.: http://64.181.189.174:5678 */
  baseUrl: string
  /** Nome do caminho do webhook no n8n — o "Path" do nó Webhook, ex.: csib */
  path: string
  /** URL completa gravada por configurações anteriores, quando base/caminho não existiam.
   *  Continua sendo respeitada para não quebrar quem já configurou. */
  webhookUrl: string
  /** Sent as `X-CSIB-Token`. Server-side only — never serialised to the browser. */
  secret: string | null
  /** Channels routed through n8n. Anything else falls back to the console provider. */
  channels: MessageChannel[]
}

export type ClinicSettingsShape = {
  integrations?: {
    n8n?: Partial<N8nIntegration>
  }
}

export const DEFAULT_N8N: N8nIntegration = {
  enabled: false,
  baseUrl: "",
  path: "",
  webhookUrl: "",
  secret: null,
  channels: ["whatsapp"],
}

const CHANNELS: MessageChannel[] = ["whatsapp", "sms", "email"]

function coerceN8n(raw: unknown): N8nIntegration {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_N8N }
  const value = raw as Partial<N8nIntegration>
  const channels = Array.isArray(value.channels)
    ? value.channels.filter((c): c is MessageChannel => CHANNELS.includes(c as MessageChannel))
    : DEFAULT_N8N.channels

  return {
    enabled: value.enabled === true,
    baseUrl: typeof value.baseUrl === "string" ? value.baseUrl : "",
    path: typeof value.path === "string" ? value.path : "",
    webhookUrl: typeof value.webhookUrl === "string" ? value.webhookUrl : "",
    secret: typeof value.secret === "string" && value.secret ? value.secret : null,
    channels: channels.length > 0 ? channels : DEFAULT_N8N.channels,
  }
}

/**
 * URL efetiva do webhook.
 *
 * O n8n expõe DOIS endereços para o mesmo nó, diferindo só no prefixo: `/webhook-test/<path>`
 * só responde enquanto alguém clicou em "Listen for test event" no editor, e `/webhook/<path>`
 * é o de produção, que só existe depois do workflow estar ativo. Testar contra o de produção
 * com o workflow inativo devolve 404 e parece erro de configuração — daí os dois modos.
 *
 * Quando base e caminho não estão preenchidos, cai na URL completa gravada pelo formato
 * antigo, para não quebrar configurações existentes.
 */
export function n8nWebhookUrl(
  config: Pick<N8nIntegration, "baseUrl" | "path" | "webhookUrl">,
  mode: "production" | "test" = "production"
): string {
  const urls = composeWebhookUrls(config.baseUrl, config.path)
  if (!urls) return config.webhookUrl.trim()
  return mode === "test" ? urls.test : urls.production
}

export async function getClinicSettings(supabase: DB, clinicId: string): Promise<ClinicSettingsShape> {
  const { data, error } = await supabase
    .from("clinic_settings")
    .select("settings")
    .eq("clinic_id", clinicId)
    .maybeSingle()
  if (error) throw error
  return (data?.settings as ClinicSettingsShape) ?? {}
}

export async function getN8nIntegration(supabase: DB, clinicId: string): Promise<N8nIntegration> {
  try {
    const settings = await getClinicSettings(supabase, clinicId)
    return coerceN8n(settings.integrations?.n8n)
  } catch (err) {
    // Messaging must never take a screen down because settings are unreadable.
    if (pendingMigrationFor(err)) return { ...DEFAULT_N8N }
    throw err
  }
}

/**
 * Writes the n8n block, preserving the rest of the settings blob. `secret: undefined`
 * keeps the stored secret — that is what lets the UI show a masked field and only
 * overwrite when the operator actually types a new value.
 */
export async function saveN8nIntegration(
  supabase: DB,
  clinicId: string,
  input: {
    enabled: boolean
    baseUrl: string
    path: string
    webhookUrl: string
    secret?: string | null
    channels: MessageChannel[]
  }
) {
  const current = await getClinicSettings(supabase, clinicId)
  const currentN8n = coerceN8n(current.integrations?.n8n)

  const next: ClinicSettingsShape = {
    ...current,
    integrations: {
      ...current.integrations,
      n8n: {
        enabled: input.enabled,
        baseUrl: input.baseUrl,
        path: input.path,
        webhookUrl: input.webhookUrl,
        secret: input.secret === undefined ? currentN8n.secret : input.secret,
        channels: input.channels,
      },
    },
  }

  const { data, error } = await supabase
    .from("clinic_settings")
    .upsert({ clinic_id: clinicId, settings: next as unknown as Json })
    .select("clinic_id")
  if (error) throw error
  if (!data || data.length === 0) throw new Error("Não foi possível salvar as configurações.")
}

// ---------------------------------------------------------------------------
// Branding
// ---------------------------------------------------------------------------

export type ClinicBranding = {
  name: string
  logoUrl: string | null
  mascotUrl: string | null
  primaryColor: string
}

export async function getClinicBranding(supabase: DB, clinicId: string): Promise<ClinicBranding> {
  const { data, error } = await supabase
    .from("clinics")
    .select("name, logo_url, mascot_url, primary_color")
    .eq("id", clinicId)
    .single()
  if (error) throw error
  return {
    name: data.name,
    logoUrl: data.logo_url,
    mascotUrl: data.mascot_url,
    primaryColor: data.primary_color,
  }
}

/**
 * Branding for the login screen, which renders with no session at all. Goes through the
 * `public_clinic_branding` security-definer function (migrations/003) rather than reading
 * `clinics` directly, because that table's RLS requires clinic membership — and loosening
 * it to make a logo visible would expose the rest of the row.
 *
 * Returns null on any failure, including the migration not being applied: a missing logo
 * must fall back to the bundled asset, never break the only way into the product.
 */
export async function getPublicBranding(supabase: DB): Promise<ClinicBranding | null> {
  try {
    const { data, error } = await supabase.rpc("public_clinic_branding", { p_slug: null })
    if (error) throw error
    const row = data?.[0]
    if (!row) return null
    return {
      name: row.name,
      logoUrl: row.logo_url,
      mascotUrl: row.mascot_url,
      primaryColor: row.primary_color,
    }
  } catch {
    return null
  }
}

export async function updateClinicBranding(
  supabase: DB,
  clinicId: string,
  input: { logo_url?: string | null; mascot_url?: string | null }
) {
  const { data, error } = await supabase
    .from("clinics")
    .update(input)
    .eq("id", clinicId)
    .select("id")
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error("Não foi possível atualizar a identidade visual desta clínica.")
  }
}
