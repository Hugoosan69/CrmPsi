import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/supabase"
import { createAdminClient } from "@/lib/supabase/admin"

type DB = SupabaseClient<Database>

export type ClinicMember = {
  membershipId: string
  userId: string
  fullName: string
  email: string
  roleId: string
  roleName: string
  roleSlug: string
  active: boolean
}

export async function listRoles(supabase: DB, clinicId: string) {
  const { data, error } = await supabase
    .from("roles")
    .select("id, slug, name, is_system")
    .or(`clinic_id.is.null,clinic_id.eq.${clinicId}`)
    .order("name")
  if (error) throw error
  return data
}

export async function listClinicMembers(supabase: DB, clinicId: string): Promise<ClinicMember[]> {
  const { data: memberships, error } = await supabase
    .from("clinic_memberships")
    .select("id, user_id, role_id, active")
    .eq("clinic_id", clinicId)
  if (error) throw error
  if (!memberships || memberships.length === 0) return []

  const userIds = memberships.map((m) => m.user_id)
  const roleIds = [...new Set(memberships.map((m) => m.role_id))]

  const [{ data: profiles }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").in("id", userIds),
    supabase.from("roles").select("id, slug, name").in("id", roleIds),
  ])

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))
  const roleById = new Map((roles ?? []).map((r) => [r.id, r]))

  return memberships.map((m) => {
    const profile = profileById.get(m.user_id)
    const role = roleById.get(m.role_id)
    return {
      membershipId: m.id,
      userId: m.user_id,
      fullName: profile?.full_name ?? "—",
      email: profile?.email ?? "—",
      roleId: m.role_id,
      roleName: role?.name ?? "—",
      roleSlug: role?.slug ?? "",
      active: m.active,
    }
  })
}

export type CreateStaffUserInput = {
  fullName: string
  email: string
  roleId: string
}

/**
 * Creates the auth.users row (via Supabase Auth Admin API — cannot be done with a plain
 * insert), then profiles + clinic_memberships. Uses the service-role client because
 * profiles/clinic_memberships writes for a new user aren't something the acting admin's
 * own RLS-scoped session can do for someone who isn't a member yet.
 */
export async function createStaffUser(clinicId: string, input: CreateStaffUserInput) {
  const admin = createAdminClient()

  const { data: created, error: createError } = await admin.auth.admin.inviteUserByEmail(
    input.email,
    { data: { full_name: input.fullName } }
  )
  if (createError || !created.user) {
    throw createError ?? new Error("Falha ao convidar usuário")
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: created.user.id,
    full_name: input.fullName,
    email: input.email,
  })
  if (profileError) throw profileError

  const { error: membershipError } = await admin.from("clinic_memberships").insert({
    clinic_id: clinicId,
    user_id: created.user.id,
    role_id: input.roleId,
  })
  if (membershipError) throw membershipError

  return created.user.id
}

export async function updateMembershipRole(supabase: DB, membershipId: string, roleId: string) {
  const { error } = await supabase
    .from("clinic_memberships")
    .update({ role_id: roleId })
    .eq("id", membershipId)
  if (error) throw error
}

export async function setMembershipActive(supabase: DB, membershipId: string, active: boolean) {
  const { error } = await supabase
    .from("clinic_memberships")
    .update({ active })
    .eq("id", membershipId)
  if (error) throw error
}
