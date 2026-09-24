import "server-only"

import { cookies } from "next/headers"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/supabase"

const SANDBOX_COOKIE = "csib-sandbox"

export function isSandboxConfigured(): boolean {
  return Boolean(
    process.env.SANDBOX_SUPABASE_URL &&
      process.env.SANDBOX_SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function isSandboxMode(): Promise<boolean> {
  if (!isSandboxConfigured()) return false
  try {
    const store = await cookies()
    return store.get(SANDBOX_COOKIE)?.value === "1"
  } catch {
    return false
  }
}

export async function setSandboxMode(on: boolean) {
  const store = await cookies()
  if (on) {
    store.set(SANDBOX_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    })
  } else {
    store.delete(SANDBOX_COOKIE)
  }
}

export function createSandboxClient() {
  const url = process.env.SANDBOX_SUPABASE_URL
  const key = process.env.SANDBOX_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      "Sandbox não configurado. Defina SANDBOX_SUPABASE_URL e SANDBOX_SUPABASE_SERVICE_ROLE_KEY em .env.local."
    )
  }
  return createSupabaseClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
