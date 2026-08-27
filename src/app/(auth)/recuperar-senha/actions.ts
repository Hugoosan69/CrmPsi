"use server"

import { headers } from "next/headers"

import { createClient } from "@/lib/supabase/server"
import { passwordResetRequestSchema } from "@/schemas/auth.schema"

export type ResetRequestState = { error?: string; sent?: boolean }

/**
 * Absolute URL Supabase should send the operator back to. Derived from the incoming request
 * so the same code works on localhost, on a Vercel preview and in production, with
 * NEXT_PUBLIC_SITE_URL as an override for setups behind a proxy that rewrites Host.
 *
 * Whatever this resolves to must also be listed under Authentication → URL Configuration →
 * Redirect URLs in the Supabase project, or Supabase silently falls back to Site URL.
 */
async function resetRedirectUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL
  if (configured) return `${configured.replace(/\/$/, "")}/redefinir-senha`

  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}/redefinir-senha`
}

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
