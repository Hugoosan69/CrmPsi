"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import { inviteUserSchema } from "@/schemas/user.schema"
import {
  createStaffUser,
  getMemberEmailForClinic,
  sendPasswordResetEmail,
  setMembershipActive,
  updateMembershipRole,
} from "@/services/users.service"
import { resetRedirectUrl } from "@/lib/auth/password-reset"
import {
  getPermission,
  setRolePermission,
  setUserPermissionOverride,
  type OverrideState,
} from "@/services/permissions.service"
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
  const supabase = await createClient()

  // Revoking users.manage from your own role removes the only way back into this screen,
  // and there is no recovery path short of SQL. Refuse it, whatever the UI allowed.
  if (!granted && roleId === membership.roleId) {
    const permission = await getPermission(supabase, permissionId)
    if (permission?.slug === PERMISSIONS.USERS_MANAGE) {
      throw new Error(
        "Você não pode remover a permissão de gerenciar usuários do seu próprio papel — isso bloquearia seu acesso a esta tela permanentemente."
      )
    }
  }

  await setRolePermission(supabase, membership.clinicId, roleId, permissionId, granted)

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

/**
 * Sends a member the standard password-recovery email.
 *
 * The address is resolved from the membership row *scoped to the caller's clinic* rather
 * than accepted as an argument — otherwise an admin could aim a recovery link at any
 * address in the system, which is an account-takeover primitive, not a support tool.
 * A membership from another clinic simply reads as not found.
 *
 * Unlike the anonymous form on /recuperar-senha, this one reports failure honestly: the
 * caller already knows the account exists (it is in their own members table), so there is
 * no enumeration to protect against, and an admin needs to know whether the mail went out.
 */
export async function sendPasswordResetForMemberAction(
  membershipId: string
): Promise<UserActionState> {
  const membership = await requirePermission(PERMISSIONS.USERS_MANAGE)
  const supabase = await createClient()

  try {
    const email = await getMemberEmailForClinic(supabase, membership.clinicId, membershipId)
    if (!email) {
      return { error: "Usuário não encontrado nesta clínica." }
    }

    await sendPasswordResetEmail(email, await resetRedirectUrl())

    // Recorded because "who asked for a reset on whose account, and when" is exactly the
    // trail an investigation needs. The link itself is never logged.
    await recordAudit({
      clinicId: membership.clinicId,
      userId: membership.userId,
      action: "user.password_reset_sent",
      entityType: "clinic_membership",
      entityId: membershipId,
      after: { email },
    })
  } catch (err) {
    console.error("sendPasswordResetForMemberAction failed", err)
    return { error: "Não foi possível enviar o e-mail de redefinição. Tente novamente." }
  }

  return { success: true }
}

/**
 * Define a exceção de permissão de uma pessoa (concedida / negada / herda do papel).
 *
 * Substitui a edição de papéis nesta tela. Os cinco papéis distribuídos têm clinic_id null
 * — são compartilhados por todas as clínicas —, então alterá-los mudaria as permissões de
 * outros tenants; setRolePermission() recusa isso, e como nenhuma clínica tem papel próprio
 * a tela ficava sem nenhuma ação possível. A exceção por pessoa dá o mesmo resultado
 * prático ("este financeiro também cadastra profissional") sem tocar em nada compartilhado.
 */
export async function setUserPermissionAction(
  targetUserId: string,
  permissionId: string,
  state: OverrideState
): Promise<UserActionState> {
  const membership = await requirePermission(PERMISSIONS.USERS_MANAGE)
  const supabase = await createClient()

  // Tirar users.manage de si mesmo remove o único caminho de volta para esta tela, e não
  // há recuperação sem SQL. O modelo por pessoa torna isso MAIS fácil de disparar que o
  // antigo por papel — lá era preciso rebaixar o papel inteiro; aqui basta um clique na
  // própria linha.
  if (state === "denied" && targetUserId === membership.userId) {
    const permission = await getPermission(supabase, permissionId)
    if (permission?.slug === PERMISSIONS.USERS_MANAGE) {
      return {
        error:
          "Você não pode negar a si mesmo a permissão de gerenciar usuários — isso bloquearia seu acesso a esta tela permanentemente.",
      }
    }
  }

  try {
    await setUserPermissionOverride(membership.clinicId, targetUserId, permissionId, state)

    await recordAudit({
      clinicId: membership.clinicId,
      userId: membership.userId,
      action: "permission.user_override",
      entityType: "profile",
      entityId: targetUserId,
      after: { permission_id: permissionId, state },
    })
  } catch (err) {
    console.error("setUserPermissionAction failed", err)
    return { error: "Não foi possível salvar a permissão." }
  }

  revalidatePath("/gestao/permissoes")
  return { success: true }
}
