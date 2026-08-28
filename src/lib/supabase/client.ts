"use client"

import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "@/types/supabase"
import { supabaseEnv } from "./env"

// Browser client for Client Components (read-heavy views wired to TanStack Query,
// e.g. the live queue). RLS still applies — this is never a privilege escalation path.
export function createClient() {
  return createBrowserClient<Database>(supabaseEnv.url, supabaseEnv.anonKey)
}

/**
 * Client for screens that consume an auth callback themselves.
 *
 * `detectSessionInUrl` is off because the automatic path cannot be trusted here:
 * `createBrowserClient` defaults to `flowType: 'pkce'`, and GoTrueClient throws
 * "Not a valid PKCE flow url." the moment it sees an implicit-grant callback
 * (`#access_token=…`) on a PKCE-configured client — see the flowType mismatch switch in
 * node_modules/@supabase/auth-js/dist/main/GoTrueClient.js, `_getSessionFromURL`.
 *
 * Which of the two shapes Supabase actually sends depends on project configuration, not on
 * what this client asks for, so guessing wrong silently produces "link inválido" on a
 * perfectly good link. The recovery screen reads the URL itself and calls the matching API,
 * which works for either flow.
 */
export function createAuthCallbackClient() {
  return createBrowserClient<Database>(supabaseEnv.url, supabaseEnv.anonKey, {
    auth: { detectSessionInUrl: false },
  })
}
