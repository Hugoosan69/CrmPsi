import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

import { supabaseEnv } from "@/lib/supabase/env"

const PUBLIC_PATHS = ["/login"]

/**
 * Next.js 16 renamed middleware.ts -> proxy.ts. This only does an optimistic
 * authenticated-or-not redirect (checked against Supabase Auth, not our Postgres tables).
 * Real permission checks (which clinic, which role, which permission) live in
 * src/lib/auth/session.ts and run again in every Server Action/Server Component —
 * this file must never be the only gate.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

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

  const {
    data: { user },
  } = await supabase.auth.getUser()

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|branding/).*)"],
}
