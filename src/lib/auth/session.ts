import "server-only"

import { cache } from "react"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

export type CurrentMembership = {
  userId: string
  fullName: string
  email: string
  clinicId: string
  clinicName: string
  clinicSlug: string
  roleId: string
  roleSlug: string
  roleName: string
  permissions: Set<string>
}

/**
 * The Data Access Layer for authorization (Next.js 16 guidance: real auth checks belong
 * here, close to the data, not in proxy.ts — proxy.ts only does optimistic redirects).
 * Cached per request so pages/layouts/Server Actions can all call it without re-querying.
 */
export const getCurrentMembership = cache(async (): Promise<CurrentMembership | null> => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: membership } = await supabase
    .from("clinic_memberships")
    .select("clinic_id, role_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle()
  if (!membership) return null

  const [{ data: clinic }, { data: role }, { data: profile }] = await Promise.all([
    supabase.from("clinics").select("id, name, slug").eq("id", membership.clinic_id).single(),
    supabase.from("roles").select("id, slug, name").eq("id", membership.role_id).single(),
    supabase.from("profiles").select("full_name, email").eq("id", user.id).single(),
  ])
  if (!clinic || !role) return null

  const { data: rolePermissions } = await supabase
    .from("role_permissions")
    .select("permission_id")
    .eq("role_id", role.id)

  const permissionIds = (rolePermissions ?? []).map((rp) => rp.permission_id)
  let permissions = new Set<string>()
  if (permissionIds.length > 0) {
    const { data: permissionRows } = await supabase
      .from("permissions")
      .select("slug")
      .in("id", permissionIds)
    permissions = new Set((permissionRows ?? []).map((p) => p.slug))
  }

  return {
    userId: user.id,
    fullName: profile?.full_name ?? user.email ?? "",
    email: profile?.email ?? user.email ?? "",
    clinicId: clinic.id,
    clinicName: clinic.name,
    clinicSlug: clinic.slug,
    roleId: role.id,
    roleSlug: role.slug,
    roleName: role.name,
    permissions,
  }
})

/** Redirects to /login when there is no active session or clinic membership. */
export async function requireMembership(): Promise<CurrentMembership> {
  const membership = await getCurrentMembership()
  if (!membership) redirect("/login")
  return membership
}

export function hasPermission(membership: CurrentMembership, slug: string): boolean {
  return membership.permissions.has(slug)
}

/**
 * Guards a Server Action or Server Component. Never rely on the UI having hidden the
 * button that got here — this check is the one that actually matters (item 23).
 */
export async function requirePermission(slug: string): Promise<CurrentMembership> {
  const membership = await requireMembership()
  if (!hasPermission(membership, slug)) {
    redirect("/dashboard?error=forbidden")
  }
  return membership
}
