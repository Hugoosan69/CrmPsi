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

export async function getPermission(supabase: DB, permissionId: string) {
  const { data, error } = await supabase
    .from("permissions")
    .select("id, slug")
    .eq("id", permissionId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getRole(supabase: DB, roleId: string) {
  const { data, error } = await supabase
    .from("roles")
    .select("id, slug, name, clinic_id")
    .eq("id", roleId)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * roles/permissions/role_permissions have no client-facing write policy (see
 * database/01_identity/schema.sql) — every mutation here goes through the service-role
 * client. Because that client bypasses RLS entirely, the tenant check cannot be left to
 * the database: `expectedClinicId` is verified here, against the role's own `clinic_id`.
 *
 * System roles (`clinic_id is null`, seeded in database/99_seed/seed.sql) are shared by
 * every clinic, so editing one would silently change permissions for all tenants. They
 * are refused rather than forked — forking a system role into a clinic-scoped copy also
 * has to repoint every membership that references it, which is a migration, not a
 * checkbox. Callers must already have passed requirePermission('users.manage').
 */
export async function setRolePermission(
  supabase: DB,
  expectedClinicId: string,
  roleId: string,
  permissionId: string,
  granted: boolean
) {
  const role = await getRole(supabase, roleId)
  if (!role) throw new Error("Papel não encontrado.")

  if (role.clinic_id === null) {
    throw new Error(
      `"${role.name}" é um papel padrão do sistema, compartilhado por todas as clínicas — alterá-lo mudaria as permissões de todos os tenants. Crie um papel próprio da clínica para personalizar permissões.`
    )
  }

  if (role.clinic_id !== expectedClinicId) {
    throw new Error("Este papel pertence a outra clínica.")
  }

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
