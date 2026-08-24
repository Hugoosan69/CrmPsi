"use client"

import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "@/types/supabase"
import { supabaseEnv } from "./env"

// Browser client for Client Components (read-heavy views wired to TanStack Query,
// e.g. the live queue). RLS still applies — this is never a privilege escalation path.
export function createClient() {
  return createBrowserClient<Database>(supabaseEnv.url, supabaseEnv.anonKey)
}
