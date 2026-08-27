import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

import { isSupabaseConfigured, supabaseEnv } from "@/lib/supabase/env"

// /redefinir-senha is reachable without a session on purpose: Supabase returns the operator
// with the recovery token in the URL *fragment*, which never reaches the server, so an
// optimistic redirect to /login here would destroy the token before the browser could read
// it. The page itself is inert without a valid token.
const PUBLIC_PATHS = ["/login", "/recuperar-senha", "/redefinir-senha"]

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
