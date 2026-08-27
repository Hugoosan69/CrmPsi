"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import { brandingSchema, n8nSettingsSchema } from "@/schemas/settings.schema"
import {
  getN8nIntegration,
  saveN8nIntegration,
  updateClinicBranding,
} from "@/services/clinic-settings.service"
import { recordAudit } from "@/services/audit.service"
import { describeDbError } from "@/lib/db-errors"
import type { MessageChannel } from "@/types/supabase"

export type SettingsActionState = { error?: string; success?: string }

function revalidateSettings() {
  revalidatePath("/gestao/configuracoes")
  revalidatePath("/login")
  revalidatePath("/", "layout")
}

// ---------------------------------------------------------------------------
// Branding
// ---------------------------------------------------------------------------

const BRANDING_BUCKET = "branding"
const MAX_LOGO_BYTES = 2 * 1024 * 1024
const ALLOWED_LOGO_TYPES = ["image/svg+xml", "image/png", "image/jpeg", "image/webp"]

export async function saveBrandingAction(
  _prev: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const membership = await requirePermission(PERMISSIONS.SETTINGS_MANAGE)
  const supabase = await createClient()

  const file = formData.get("logo_file")
  const hasUpload = file instanceof File && file.size > 0

  let logoUrl: string | null

  if (hasUpload) {
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      return { error: "Formato não aceito. Envie SVG, PNG, JPEG ou WebP." }
    }
    if (file.size > MAX_LOGO_BYTES) {
      return { error: "Arquivo muito grande. O limite é 2 MB." }
    }

    // The bucket is public-read (migrations/003) because the login screen is
    // unauthenticated; the write goes through the admin client after the permission
    // check above, so it does not depend on the storage policy being present.
    const admin = createAdminClient()
    const extension = file.name.includes(".") ? file.name.split(".").pop() : "png"
    const path = `${membership.clinicId}/logo-${Date.now()}.${extension}`

    const { error: uploadError } = await admin.storage
      .from(BRANDING_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: true })

    if (uploadError) {
      return {
        error: `Não foi possível enviar o arquivo: ${uploadError.message}. Verifique se a migration 003 criou o bucket "branding".`,
      }
    }

    const { data } = admin.storage.from(BRANDING_BUCKET).getPublicUrl(path)
    logoUrl = data.publicUrl
  } else {
    const parsed = brandingSchema.safeParse({ logo_url: formData.get("logo_url") ?? "" })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
    logoUrl = parsed.data.logo_url
  }

  try {
    await updateClinicBranding(supabase, membership.clinicId, { logo_url: logoUrl })
  } catch (err) {
    return { error: describeDbError(err) }
  }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "settings.branding_update",
    entityType: "clinic",
    entityId: membership.clinicId,
    after: { logo_url: logoUrl },
  })

  revalidateSettings()
  return { success: hasUpload ? "Logo enviada e aplicada." : "Identidade visual atualizada." }
}

// ---------------------------------------------------------------------------
// n8n messaging integration
// ---------------------------------------------------------------------------

function parseN8nForm(formData: FormData) {
  return n8nSettingsSchema.safeParse({
    enabled: formData.get("enabled") === "on" || formData.get("enabled") === "true",
    webhook_url: formData.get("webhook_url") ?? "",
    secret: formData.get("secret") ?? "",
    clear_secret: formData.get("clear_secret") === "on",
    channels: formData.getAll("channels").map(String),
  })
}

export async function saveN8nAction(
  _prev: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const membership = await requirePermission(PERMISSIONS.SETTINGS_MANAGE)

  const parsed = parseN8nForm(formData)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }

  const supabase = await createClient()

  try {
    await saveN8nIntegration(supabase, membership.clinicId, {
      enabled: parsed.data.enabled,
      webhookUrl: parsed.data.webhook_url,
      // undefined keeps the stored secret; null clears it deliberately.
      secret: parsed.data.clear_secret ? null : parsed.data.secret,
      channels: parsed.data.channels as MessageChannel[],
    })
  } catch (err) {
    return { error: describeDbError(err) }
  }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "settings.integration_update",
    entityType: "clinic_settings",
    entityId: membership.clinicId,
    // The secret is deliberately absent from the audit payload.
    after: {
      integration: "n8n",
      enabled: parsed.data.enabled,
      webhookUrl: parsed.data.webhook_url,
      channels: parsed.data.channels,
      secretChanged: Boolean(parsed.data.secret) || Boolean(parsed.data.clear_secret),
    },
  })

  revalidateSettings()
  return { success: "Integração salva." }
}

/**
 * Fires one ping at the configured webhook so the operator finds out here, rather than
 * discovering it from a patient who never got a reminder. Reads the stored config instead
 * of trusting the form, so what is tested is what will actually run.
 */
export async function testN8nAction(): Promise<SettingsActionState> {
  const membership = await requirePermission(PERMISSIONS.SETTINGS_MANAGE)
  const supabase = await createClient()

  const config = await getN8nIntegration(supabase, membership.clinicId)
  if (!config.webhookUrl) {
    return { error: "Informe e salve a URL do webhook antes de testar." }
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (config.secret) headers["X-CSIB-Token"] = config.secret

  try {
    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        test: true,
        clinicId: membership.clinicId,
        channel: config.channels[0] ?? "whatsapp",
        to: "+5561999999999",
        subject: "Teste de integração CSIB",
        body: "Esta é uma mensagem de teste enviada pelo CSIB. Se você a recebeu no n8n, a integração está funcionando.",
        requestedAt: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(15_000),
    })

    const text = (await response.text()).slice(0, 300)

    await recordAudit({
      clinicId: membership.clinicId,
      userId: membership.userId,
      action: "settings.integration_test",
      entityType: "clinic_settings",
      entityId: membership.clinicId,
      after: { integration: "n8n", httpStatus: response.status },
    })

    if (!response.ok) {
      return { error: `O n8n respondeu ${response.status}. ${text || "Sem corpo na resposta."}` }
    }
    return { success: `Webhook respondeu ${response.status}. A integração está acessível.` }
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido"
    return {
      error: `Não foi possível alcançar o webhook: ${message}. Confirme a URL e se o n8n está acessível a partir deste servidor.`,
    }
  }
}
