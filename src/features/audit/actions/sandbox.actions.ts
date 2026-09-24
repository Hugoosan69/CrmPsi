"use server"

import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import { setSandboxMode, isSandboxConfigured } from "@/lib/supabase/sandbox"
import { recordAudit } from "@/services/audit.service"

export type SandboxActionState = { error?: string; success?: string }

export async function toggleSandboxAction(
  on: boolean
): Promise<SandboxActionState> {
  if (!isSandboxConfigured()) {
    return {
      error:
        "Sandbox não configurado. Defina SANDBOX_SUPABASE_URL e SANDBOX_SUPABASE_SERVICE_ROLE_KEY no servidor.",
    }
  }

  const membership = await requirePermission(PERMISSIONS.SANDBOX_TOGGLE)

  await setSandboxMode(on)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "sandbox.toggle",
    entityType: "clinic_settings",
    entityId: membership.clinicId,
    after: { sandbox: on },
  })

  return {
    success: on
      ? "Modo sandbox ativado. Todas as operações agora usam o banco de homologação."
      : "Modo sandbox desativado. Operações voltaram ao banco de produção.",
  }
}
