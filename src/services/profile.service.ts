import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient as createStandaloneClient } from "@supabase/supabase-js"

import type { Database } from "@/types/supabase"
import { supabaseEnv } from "@/lib/supabase/env"

type DB = SupabaseClient<Database>

export type OwnProfile = {
  id: string
  fullName: string
  email: string
  phone: string | null
  avatarUrl: string | null
}

export async function getOwnProfile(supabase: DB, userId: string): Promise<OwnProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, avatar_url")
    .eq("id", userId)
    .single()
  if (error) throw error

  return {
    id: data.id,
    fullName: data.full_name,
    email: data.email,
    phone: data.phone,
    avatarUrl: data.avatar_url,
  }
}

/**
 * Only ever the caller's own row: `profiles` has no self-update policy beyond identity, so
 * the `eq("id", userId)` is both the filter and the authorization, and the rowcount check
 * turns a silently-matched-nothing update into a real error.
 */
export async function updateOwnProfile(
  supabase: DB,
  userId: string,
  input: { full_name?: string; phone?: string | null; avatar_url?: string | null }
) {
  const { data, error } = await supabase
    .from("profiles")
    .update(input)
    .eq("id", userId)
    .select("id")
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error("Não foi possível atualizar o perfil.")
  }
}

/**
 * Verifies a password without touching the caller's session.
 *
 * Supabase does not require the current password to set a new one, which means a hijacked
 * session could lock the real owner out. Re-authenticating first closes that. It has to run
 * on a standalone client with persistence disabled — using the request-bound server client
 * would rotate the session cookie as a side effect of a *check*.
 */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const probe = createStandaloneClient(supabaseEnv.url, supabaseEnv.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { error } = await probe.auth.signInWithPassword({ email, password })
  if (error) return false

  // Drop the throwaway session immediately; it was only ever a credential check.
  await probe.auth.signOut()
  return true
}

export async function updateOwnPassword(supabase: DB, newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}
