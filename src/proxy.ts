import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

import { isSupabaseConfigured, supabaseEnv } from "@/lib/supabase/env"
import { CANONICAL_HOST, shouldRedirectToCanonical } from "@/config/site"

// /redefinir-senha is reachable without a session on purpose — the recovery link puts the
// caller here before any session cookie exists.
const PUBLIC_PATHS = ["/login", "/recuperar-senha", "/redefinir-senha"]

/**
 * Supabase can return a recovery callback in either of two shapes, and which one depends on
 * the project's own configuration, not on what this app requests:
 *
 *   - implicit: `#access_token=…&type=recovery` — a fragment, never sent to the server.
 *     This is what the CSIB project actually sends today, verified against a real email.
 *   - PKCE: `?code=…` — a real query parameter, which does reach the server.
 *
 * The fragment is handled entirely in the browser by /redefinir-senha, which reads it
 * directly (see new-password-form.tsx for why the automatic path cannot be used).
 *
 * The `?code=` case is what this function exists for. A query parameter survives to the
 * server but is NOT carried through a redirect: the root page's `redirect("/dashboard")`
 * and this proxy's own "no session yet" bounce to /login both construct a fresh URL and
 * drop the incoming query string. So a `code` landing on the wrong path — wherever Site URL
 * points when redirectTo isn't allow-listed — would be destroyed before any page ran.
 *
 * This app has no other feature that produces a `?code=` parameter (no OAuth, no magic
 * link) — email/password and this recovery flow are the only auth paths — so a `code` on
 * any request is unambiguously a Supabase auth callback, and every one of them belongs on
 * /redefinir-senha. Checked and forwarded here, before the session lookup and before
 * page.tsx or the public/private gate below ever run, so it wins the race against every
 * other redirect in the app regardless of what the confirmation link's landing path was.
 */
function recoveryCodeRedirect(request: NextRequest): NextResponse | null {
  const code = request.nextUrl.searchParams.get("code")
  if (!code || request.nextUrl.pathname === "/redefinir-senha") return null

  const target = new URL("/redefinir-senha", request.url)
  target.search = request.nextUrl.search
  return NextResponse.redirect(target)
}

/**
 * Next.js 16 renamed middleware.ts -> proxy.ts. This only does an optimistic
 * authenticated-or-not redirect (checked against Supabase Auth, not our Postgres tables).
 * Real permission checks (which clinic, which role, which permission) live in
 * src/lib/auth/session.ts and run again in every Server Action/Server Component —
 * this file must never be the only gate.
 */
export async function proxy(request: NextRequest) {
  // Host canônico ANTES de qualquer outra coisa.
  //
  // O link de recuperação pode chegar apontando para o endereço antigo da Vercel — o
  // Supabase cai no Site URL do projeto quando o redirectTo não está na allowlist. Isso não
  // é só cosmético: o `code_verifier` do PKCE é um cookie preso ao domínio onde o pedido
  // nasceu, então abrir o link noutro host faz a troca do código falhar e a tela dizer
  // "link inválido" para um link válido. E, seguindo a partir dali, toda a navegação fica
  // no host errado.
  //
  // 308 e não 307: preserva o método e sinaliza permanência, então o navegador e os
  // buscadores param de voltar ao endereço antigo.
  const requestHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  if (shouldRedirectToCanonical(requestHost)) {
    const target = new URL(request.nextUrl.toString())
    target.host = CANONICAL_HOST
    target.port = ""
    target.protocol = "https:"
    return NextResponse.redirect(target, 308)
  }

  let response = NextResponse.next({ request })

  // The matcher covers essentially every route, so anything thrown here takes the whole
  // site down — including /login, leaving no way back in. When Supabase isn't configured
  // (a missing or misnamed env var on a fresh deploy), skip the optimistic redirect and
  // let each page surface its own error. Security is unaffected: the real check is
  // requireMembership() in the Data Access Layer, which still refuses without a session.
  if (!isSupabaseConfigured()) {
    console.error(
      "proxy: Supabase env vars ausentes — verifique NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no ambiente do deploy."
    )
    return response
  }

  const recoveryRedirect = recoveryCodeRedirect(request)
  if (recoveryRedirect) return recoveryRedirect

  const supabase = createServerClient(supabaseEnv.url, supabaseEnv.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // A transient Supabase outage must not lock everyone out of the app either.
  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (err) {
    console.error("proxy: falha ao consultar a sessao no Supabase", err)
    return response
  }

  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path))

  if (!user && !isPublicPath) {
    const loginUrl = new URL("/login", request.url)
    return NextResponse.redirect(loginUrl)
  }

  if (user && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return response
}

export const config = {
  // /api/health é excluído para a sonda responder mesmo com a autenticação quebrada — é o
  // propósito dela. /api/integrations/* pelo mesmo motivo, por outra razão: são endpoints
  // máquina-a-máquina, autenticados por token próprio no cabeçalho. Deixá-los sob o proxy
  // faz o n8n receber um 307 para a tela de login em vez da fila de mensagens, o que se
  // parece com endpoint fora do ar.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|branding/|api/health|api/integrations).*)",
  ],
}
