"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import { professionalSchema } from "@/schemas/professional.schema"
import { createUserForProfessionalSchema } from "@/schemas/user.schema"
import {
  createProfessional,
  setProfessionalActive,
  updateProfessional,
} from "@/services/professionals.service"
import { createUserForProfessional } from "@/services/users.service"
import { recordAudit } from "@/services/audit.service"

export type ProfessionalActionState = { error?: string; success?: boolean }

export async function createProfessionalAction(
  _prev: ProfessionalActionState,
  formData: FormData
): Promise<ProfessionalActionState> {
  const membership = await requirePermission(PERMISSIONS.PROFESSIONALS_MANAGE)

  const raw = Object.fromEntries(formData)
  const parsed = professionalSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createClient()
  await createProfessional(supabase, membership.clinicId, parsed.data)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "professional.create",
    entityType: "professional",
    after: parsed.data,
  })

  revalidatePath("/gestao/profissionais")
  return { success: true }
}

export async function updateProfessionalAction(
  professionalId: string,
  _prev: ProfessionalActionState,
  formData: FormData
): Promise<ProfessionalActionState> {
  const membership = await requirePermission(PERMISSIONS.PROFESSIONALS_MANAGE)

  const parsed = professionalSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createClient()
  await updateProfessional(supabase, membership.clinicId, professionalId, parsed.data)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "professional.update",
    entityType: "professional",
    entityId: professionalId,
    after: parsed.data,
  })

  revalidatePath("/gestao/profissionais")
  return { success: true }
}

export async function setProfessionalActiveAction(professionalId: string, active: boolean) {
  const membership = await requirePermission(PERMISSIONS.PROFESSIONALS_MANAGE)

  const supabase = await createClient()
  await setProfessionalActive(supabase, membership.clinicId, professionalId, active)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: active ? "professional.activate" : "professional.deactivate",
    entityType: "professional",
    entityId: professionalId,
  })

  revalidatePath("/gestao/profissionais")
}

/**
 * Dá acesso ao sistema a um profissional que já está cadastrado.
 *
 * Exige `users.manage`, não `professionals.manage`. A distinção importa: quem cuida da
 * equipe clínica cadastra e edita fichas, mas criar um login é outra coisa — é decidir quem
 * entra no sistema e com que papel. Estar nesta tela não muda isso.
 */
export async function createUserForProfessionalAction(
  professionalId: string,
  _prev: ProfessionalActionState,
  formData: FormData
): Promise<ProfessionalActionState> {
  const membership = await requirePermission(PERMISSIONS.USERS_MANAGE)

  const parsed = createUserForProfessionalSchema.safeParse({
    email: formData.get("email"),
    role_id: formData.get("role_id"),
    access_mode: formData.get("access_mode") ?? "password",
    password: formData.get("password") ?? undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  let newUserId: string
  try {
    newUserId = await createUserForProfessional(membership.clinicId, professionalId, {
      email: parsed.data.email,
      roleId: parsed.data.role_id,
      accessMode: parsed.data.access_mode,
      password: parsed.data.password,
    })
  } catch (err) {
    console.error("createUserForProfessionalAction failed", err)
    // A mensagem do serviço é específica e útil ("já tem acesso", "não encontrado"); só o
    // que vem do Supabase é genérico demais para repassar.
    const motivo = err instanceof Error ? err.message : ""
    return {
      error: motivo.startsWith("Este profissional") || motivo.startsWith("Profissional")
        ? motivo
        : "Não foi possível criar o acesso. Verifique se o e-mail já está em uso.",
    }
  }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "user.invite",
    entityType: "clinic_membership",
    entityId: newUserId,
    // A senha nunca entra na trilha, só o modo escolhido.
    after: {
      email: parsed.data.email,
      role_id: parsed.data.role_id,
      access_mode: parsed.data.access_mode,
      origem: "ficha de profissional",
      professional_id: professionalId,
    },
  })

  revalidatePath("/gestao/profissionais")
  revalidatePath("/gestao/usuarios")
  return { success: true }
}
