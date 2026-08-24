import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import type { Database } from "@/types/supabase"
import { supabaseEnv } from "./env"

// Server Components / Server Actions / Route Handlers client.
// Respects RLS as the signed-in user — this is what feature code should use for reads
// and for writes that don't need to bypass RLS (see admin.ts for the exception).
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(supabaseEnv.url, supabaseEnv.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Called from a Server Component render (not an Action/Route Handler) —
          // safe to ignore as long as proxy.ts refreshes the session cookie.
        }
      },
    },
  })
}
