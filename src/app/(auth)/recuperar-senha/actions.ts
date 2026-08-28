"use server"

import { createClient } from "@/lib/supabase/server"
import { resetRedirectUrl } from "@/lib/auth/password-reset"
import { passwordResetRequestSchema } from "@/schemas/auth.schema"

export type ResetRequestState = { error?: string; sent?: boolean }

export async function requestPasswordResetAction(
  _prev: ResetRequestState,
  formData: FormData
): Promise<ResetRequestState> {
  const parsed = passwordResetRequestSchema.safeParse({ email: formData.get("email") })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: await resetRedirectUrl(),
  })

  // Deliberately reports success even on failure: telling an anonymous visitor whether an
  // address exists turns this form into an account-enumeration oracle. Real errors are
  // logged for the operator instead.
  if (error) {
    console.error("resetPasswordForEmail falhou", error.message)
  }

  return { sent: true }
}
