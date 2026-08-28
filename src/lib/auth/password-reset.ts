import "server-only"

import { CANONICAL_ORIGIN } from "@/config/site"

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
  // Sempre o canônico, nunca deduzido do request. Deduzir parecia flexível e era a origem
  // do problema: quem entrasse pelo endereço antigo da Vercel recebia um link de volta para
  // lá, num domínio onde o cookie do PKCE não existe.
  return `${CANONICAL_ORIGIN}/redefinir-senha`
}
