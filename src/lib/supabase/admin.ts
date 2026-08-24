import "server-only"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/supabase"
import { supabaseEnv } from "./env"

// Service-role client — bypasses RLS entirely. Never import this outside src/services/.
// Every call site must re-check has_permission()/business rules itself before mutating,
// since the database will no longer stop it. Used for: user/role management (writing
// clinic_memberships and role_permissions, which anon users can only read), and audit_logs
// inserts (no client-facing insert policy exists for that table by design).
export function createAdminClient() {
  return createSupabaseClient<Database>(supabaseEnv.url, supabaseEnv.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
