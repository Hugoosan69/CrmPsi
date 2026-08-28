"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireMembership } from "@/lib/auth/session"
import {
  getOwnProfile,
  updateOwnPassword,
  updateOwnProfile,
  verifyPassword,
} from "@/services/profile.service"
import { recordAudit } from "@/services/audit.service"
import { describeDbError } from "@/lib/db-errors"
import { resetRedirectUrl } from "@/lib/auth/password-reset"
import { MAX_AVATAR_BYTES, formatMegabytes } from "@/config/uploads"

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

/**
 * Manda o link de redefinição para o próprio e-mail, sem sair da tela.
 *
 * Antes isto era um link para /recuperar-senha: além de abandonar o formulário que a pessoa
 * estava preenchendo, aquela tela pede o e-mail de novo — sendo que quem está logado já foi
 * identificado. Pior, terminar o fluxo por lá encerra a sessão, então quem só queria trocar
 * a senha era deslogado no meio.
 *
 * O endereço vem da sessão, nunca de um campo: um formulário aqui deixaria alguém logado
 * disparar recuperação para o e-mail de outra pessoa.
 */
export async function sendOwnPasswordResetAction(): Promise<ProfileActionState> {
  const membership = await requireMembership()

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(membership.email, {
      redirectTo: await resetRedirectUrl(),
    })
    if (error) throw error
  } catch (err) {
    console.error("sendOwnPasswordResetAction failed", err)
    return { error: "Não foi possível enviar o e-mail. Tente novamente em alguns minutos." }
  }

  return {
    success: `Link enviado para ${membership.email}. Ele vale por tempo limitado e só pode ser usado uma vez.`,
  }
}

// ---------------------------------------------------------------------------
// Foto do perfil
// ---------------------------------------------------------------------------

const AVATAR_BUCKET = "avatars"
const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"]

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
}

/**
 * Troca ou remove a própria foto.
 *
 * Escrita pelo cliente administrativo, como a logo da clínica: a autorização já aconteceu
 * em requireMembership() e no caminho, que é sempre a pasta do próprio usuário. As políticas
 * de storage de migrations/009 comparam essa primeira pasta com auth.uid() e valem para
 * qualquer upload que venha do navegador, mas aqui não são a barreira.
 *
 * SVG fica de fora da lista aceita de propósito. Diferente da logo — que a gestão envia e
 * é servida em contexto controlado — a foto de perfil é enviada por qualquer pessoa da
 * clínica, e SVG é um documento que pode carregar script.
 *
 * O nome do arquivo leva um carimbo de tempo em vez de sobrescrever um caminho fixo: o
 * bucket é público e cacheado por CDN, então reusar o mesmo endereço deixaria a foto antiga
 * aparecendo por tempo indeterminado.
 */
export async function updateAvatarAction(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const membership = await requireMembership()
  const supabase = await createClient()

  const remove = formData.get("remove") === "true"
  const file = formData.get("avatar_file")

  let avatarUrl: string | null = null

  if (!remove) {
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Escolha uma imagem." }
    }
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      return { error: "Formato não aceito. Envie PNG, JPEG ou WebP." }
    }
    if (file.size > MAX_AVATAR_BYTES) {
      return { error: `Imagem muito grande. O limite é ${formatMegabytes(MAX_AVATAR_BYTES)}.` }
    }

    const admin = createAdminClient()
    const extension = EXTENSION_BY_TYPE[file.type] ?? "png"
    const path = `${membership.userId}/avatar-${Date.now()}.${extension}`

    const { error: uploadError } = await admin.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: true })

    if (uploadError) {
      return {
        error: `Não foi possível enviar a imagem: ${uploadError.message}. Verifique se a migration 009 criou o bucket "avatars".`,
      }
    }

    avatarUrl = admin.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl
  }

  try {
    await updateOwnProfile(supabase, membership.userId, { avatar_url: avatarUrl })
  } catch (err) {
    return { error: describeDbError(err) }
  }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "profile.avatar_update",
    entityType: "profile",
    entityId: membership.userId,
    after: { avatar_url: avatarUrl },
  })

  // A foto aparece na barra lateral e no menu da conta, fora desta página.
  revalidatePath("/", "layout")
  return { success: remove ? "Foto removida." : "Foto atualizada." }
}
