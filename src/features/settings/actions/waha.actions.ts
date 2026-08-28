"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import {
  getWahaConfig,
  logoutWahaSession,
  saveWahaConfig,
  startWahaSession,
} from "@/services/waha.service"
import { recordAudit } from "@/services/audit.service"

export type WahaActionState = { error?: string; success?: string }

function revalidateSettings() {
  revalidatePath("/gestao/configuracoes")
}

export async function saveWahaAction(
  _prev: WahaActionState,
  formData: FormData
): Promise<WahaActionState> {
  const membership = await requirePermission(PERMISSIONS.SETTINGS_MANAGE)

  const baseUrl = String(formData.get("base_url") ?? "").trim()
  const session = String(formData.get("session") ?? "default").trim()
  const apiKeyRaw = String(formData.get("api_key") ?? "").trim()
  const clearKey = formData.get("clear_api_key") === "on"
  const enabled = formData.get("enabled") === "on"

  if (enabled && !/^https?:\/\/[^/\s]+/i.test(baseUrl)) {
    return { error: "Informe o endereço do servidor WAHA, ex.: http://64.181.189.174:3000" }
  }

  try {
    const supabase = await createClient()
    await saveWahaConfig(supabase, membership.clinicId, {
      enabled,
      baseUrl,
      session,
      // Vazio mantém a chave gravada; a caixa "remover" é o único jeito de apagá-la, para
      // salvar o formulário sem redigitar não desconfigurar a integração.
      apiKey: clearKey ? null : apiKeyRaw ? apiKeyRaw : undefined,
    })

    await recordAudit({
      clinicId: membership.clinicId,
      userId: membership.userId,
      action: "settings.integration_update",
      entityType: "clinic_settings",
      entityId: membership.clinicId,
      // A chave nunca entra na trilha.
      after: { integration: "waha", enabled, baseUrl, session },
    })
  } catch (err) {
    console.error("saveWahaAction failed", err)
    return { error: "Não foi possível salvar a configuração do WAHA." }
  }

  revalidateSettings()
  return { success: "Configuração salva." }
}

/** Cria/inicia a sessão para o QR aparecer. */
export async function startWahaAction(): Promise<WahaActionState> {
  const membership = await requirePermission(PERMISSIONS.SETTINGS_MANAGE)
  const supabase = await createClient()
  const config = await getWahaConfig(supabase, membership.clinicId)

  if (!config.baseUrl) return { error: "Configure e salve o servidor WAHA antes de conectar." }

  try {
    await startWahaSession(config)
  } catch (err) {
    console.error("startWahaAction failed", err)
    return { error: err instanceof Error ? err.message : "Não foi possível iniciar a sessão." }
  }

  revalidateSettings()
  return { success: "Sessão iniciada. Leia o QR code com o WhatsApp da clínica." }
}

export async function logoutWahaAction(): Promise<WahaActionState> {
  const membership = await requirePermission(PERMISSIONS.SETTINGS_MANAGE)
  const supabase = await createClient()
  const config = await getWahaConfig(supabase, membership.clinicId)

  try {
    await logoutWahaSession(config)
    await recordAudit({
      clinicId: membership.clinicId,
      userId: membership.userId,
      action: "settings.integration_update",
      entityType: "clinic_settings",
      entityId: membership.clinicId,
      after: { integration: "waha", action: "logout" },
    })
  } catch (err) {
    console.error("logoutWahaAction failed", err)
    return { error: err instanceof Error ? err.message : "Não foi possível desconectar." }
  }

  revalidateSettings()
  return { success: "Número desconectado. Para reconectar, leia um novo QR code." }
}
