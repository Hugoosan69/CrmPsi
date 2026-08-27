"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { requireMembership } from "@/lib/auth/session"
import {
  getOwnProfile,
  updateOwnPassword,
  updateOwnProfile,
  verifyPassword,
} from "@/services/profile.service"
import { recordAudit } from "@/services/audit.service"
import { describeDbError } from "@/lib/db-errors"

export type ProfileActionState = { error?: string; success?: string }

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome completo").max(120),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
})

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Informe sua senha atual"),
    new_password: z
      .string()
      .min(8, "A nova senha precisa ter ao menos 8 caracteres")
      .max(72, "Senha muito longa"),
    confirm_password: z.string(),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    message: "As senhas não coincidem",
    path: ["confirm_password"],
  })
  .refine((v) => v.new_password !== v.current_password, {
    message: "A nova senha precisa ser diferente da atual",
    path: ["new_password"],
  })

export async function updateProfileAction(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const membership = await requireMembership()

  const parsed = profileSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }

  const supabase = await createClient()
  try {
    await updateOwnProfile(supabase, membership.userId, parsed.data)
  } catch (err) {
    return { error: describeDbError(err) }
  }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "profile.update",
    entityType: "profile",
    entityId: membership.userId,
    after: parsed.data,
  })

  // The name shows in the sidebar, header and every chat message, so the whole shell
  // needs revalidating, not just this page.
  revalidatePath("/", "layout")
  return { success: "Perfil atualizado." }
}

export async function changePasswordAction(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const membership = await requireMembership()

  const parsed = passwordSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }

  const supabase = await createClient()
  const profile = await getOwnProfile(supabase, membership.userId)

  // Supabase would let a hijacked session set a new password with no proof of the old one.
  const ok = await verifyPassword(profile.email, parsed.data.current_password)
  if (!ok) return { error: "Senha atual incorreta." }

  try {
    await updateOwnPassword(supabase, parsed.data.new_password)
  } catch (err) {
    return { error: describeDbError(err) }
  }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "profile.password_change",
    entityType: "profile",
    entityId: membership.userId,
    // Deliberately no password material in the audit payload.
  })

  return { success: "Senha alterada." }
}
