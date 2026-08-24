import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/supabase"
import { createAdminClient } from "@/lib/supabase/admin"

type DB = SupabaseClient<Database>

export async function listPermissions(supabase: DB) {
  const { data, error } = await supabase
    .from("permissions")
    .select("id, slug, module, description")
    .order("module")
    .order("slug")
  if (error) throw error
  return data
}

export async function listRolePermissions(supabase: DB, roleIds: string[]) {
  const { data, error } = await supabase
    .from("role_permissions")
    .select("role_id, permission_id")
    .in("role_id", roleIds)
  if (error) throw error
  return data ?? []
}

export async function listRolePermissionIds(supabase: DB, roleId: string) {
  const { data, error } = await supabase
    .from("role_permissions")
    .select("permission_id")
    .eq("role_id", roleId)
  if (error) throw error
  return new Set((data ?? []).map((r) => r.permission_id))
}

/**
 * roles/permissions/role_permissions have no client-facing write policy (see
 * database/01_identity/schema.sql) — every mutation here goes through the service-role
 * client, and the caller must already have passed requirePermission('users.manage').
 */
export async function setRolePermission(roleId: string, permissionId: string, granted: boolean) {
  const admin = createAdminClient()
  if (granted) {
    const { error } = await admin
      .from("role_permissions")
      .upsert({ role_id: roleId, permission_id: permissionId })
    if (error) throw error
  } else {
    const { error } = await admin
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId)
      .eq("permission_id", permissionId)
    if (error) throw error
  }
}
