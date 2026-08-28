import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

import { isSupabaseConfigured, supabaseEnv } from "@/lib/supabase/env"

// /redefinir-senha is reachable without a session on purpose — the recovery link puts the
// caller here before any session cookie exists.
const PUBLIC_PATHS = ["/login", "/recuperar-senha", "/redefinir-senha"]

/**
 * `@supabase/ssr`'s createServerClient and createBrowserClient both default to
 * `flowType: 'pkce'` (see node_modules/@supabase/ssr/dist/main/createServerClient.js and createBrowserClient.js). That means a
 * password-recovery link does NOT land with the token in a URL fragment (the older
 * "implicit" flow) — it lands with a real `?code=` query parameter, because GoTrue's /verify
 * redirect encodes a PKCE code differently once a code_challenge was registered for the
 * request. A query parameter reaches the server, unlike a fragment, but it is not carried
 * automatically through a redirect: the root page's `redirect("/dashboard")` and this
 * proxy's own "no session yet" bounce to /login both construct a fresh URL and drop
 * whatever query string the incoming request had. So a `code` sitting on the wrong path
 * (wherever Supabase's Site URL happens to point when redirectTo isn't allow-listed) is
 * silently destroyed before any page runs.
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
  // /api/health is excluded so the probe answers even when auth is broken — that is the
  // whole point of having it.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|branding/|api/health).*)"],
}
