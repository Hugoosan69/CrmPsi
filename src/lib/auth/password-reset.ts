import "server-only"

import { headers } from "next/headers"

/**
 * Absolute URL Supabase should send the operator back to after a recovery link.
 *
 * Derived from the incoming request so the same code works on localhost, on a Vercel
 * preview and in production, with NEXT_PUBLIC_SITE_URL as an override for setups behind a
 * proxy that rewrites Host.
 *
 * Lives here rather than next to one caller because there are two places that start a
 * recovery — the operator asking for it on /recuperar-senha, and an admin sending one from
 * Gestão › Usuários. If they computed the target separately they would drift, and the one
 * that drifted would fail silently: Supabase does not reject an unknown `redirectTo`, it
 * quietly falls back to Site URL. (src/proxy.ts catches that fallback, but relying on the
 * rescue for a URL we control ourselves would be sloppy.)
 *
 * Whatever this resolves to must also be listed under Authentication → URL Configuration →
 * Redirect URLs in the Supabase project.
 */
export async function resetRedirectUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL
  if (configured) return `${configured.replace(/\/$/, "")}/redefinir-senha`

  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}/redefinir-senha`
}
