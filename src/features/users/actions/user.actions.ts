"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import { inviteUserSchema } from "@/schemas/user.schema"
import {
  createStaffUser,
  setMembershipActive,
  updateMembershipRole,
} from "@/services/users.service"
import { setRolePermission } from "@/services/permissions.service"
import { recordAudit } from "@/services/audit.service"

export type UserActionState = { error?: string; success?: boolean }

export async function inviteUserAction(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const membership = await requirePermission(PERMISSIONS.USERS_MANAGE)

  const parsed = inviteUserSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  try {
    const newUserId = await createStaffUser(membership.clinicId, {
      fullName: parsed.data.full_name,
      email: parsed.data.email,
      roleId: parsed.data.role_id,
    })

    await recordAudit({
      clinicId: membership.clinicId,
      userId: membership.userId,
      action: "user.invite",
      entityType: "clinic_membership",
      entityId: newUserId,
      after: { email: parsed.data.email, role_id: parsed.data.role_id },
    })
  } catch (err) {
    console.error("inviteUserAction failed", err)
    return { error: "Não foi possível convidar este usuário. Verifique se o e-mail já está em uso." }
  }

  revalidatePath("/gestao/usuarios")
  return { success: true }
}

export async function updateMembershipRoleAction(membershipId: string, roleId: string) {
  const membership = await requirePermission(PERMISSIONS.USERS_MANAGE)

  const supabase = await createClient()
  await updateMembershipRole(supabase, membershipId, roleId)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "user.role_change",
    entityType: "clinic_membership",
    entityId: membershipId,
    after: { role_id: roleId },
  })

  revalidatePath("/gestao/usuarios")
}

export async function setMembershipActiveAction(membershipId: string, active: boolean) {
  const membership = await requirePermission(PERMISSIONS.USERS_MANAGE)

  const supabase = await createClient()
  await setMembershipActive(supabase, membershipId, active)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: active ? "user.activate" : "user.deactivate",
    entityType: "clinic_membership",
    entityId: membershipId,
  })

  revalidatePath("/gestao/usuarios")
}

export async function setRolePermissionAction(roleId: string, permissionId: string, granted: boolean) {
  const membership = await requirePermission(PERMISSIONS.USERS_MANAGE)

  await setRolePermission(roleId, permissionId, granted)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: granted ? "permission.grant" : "permission.revoke",
    entityType: "role",
    entityId: roleId,
    after: { permission_id: permissionId, granted },
  })

  revalidatePath("/gestao/permissoes")
}
