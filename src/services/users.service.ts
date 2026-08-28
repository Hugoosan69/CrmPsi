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
    .select("id, slug, name, is_system, clinic_id")
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
export async function createStaffUser(
  clinicId: string,
  input: CreateStaffUserInput & {
    /** "invite" manda o link por e-mail; "password" já define a senha e libera o acesso. */
    accessMode?: "invite" | "password"
    password?: string
    professional?: { register: string | null; specialtyId: string | null } | null
  }
) {
  const admin = createAdminClient()

  // Os dois caminhos existem porque dependem de coisas diferentes: o convite depende do SMTP
  // do projeto estar entregando, e quando não está a pessoa fica sem acesso nenhum e sem
  // sinal de erro. Definir a senha na hora não depende de e-mail.
  let userId: string
  if (input.accessMode === "password") {
    if (!input.password) throw new Error("Senha obrigatória para este modo de acesso.")
    const { data, error } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true, // sem isto o login é recusado com "Email not confirmed"
      user_metadata: { full_name: input.fullName },
    })
    if (error || !data.user) throw error ?? new Error("Falha ao criar usuário")
    userId = data.user.id
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, {
      data: { full_name: input.fullName },
    })
    if (error || !data.user) throw error ?? new Error("Falha ao convidar usuário")
    userId = data.user.id
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    full_name: input.fullName,
    email: input.email,
  })
  if (profileError) throw profileError

  const { error: membershipError } = await admin.from("clinic_memberships").insert({
    clinic_id: clinicId,
    user_id: userId,
    role_id: input.roleId,
  })
  if (membershipError) throw membershipError

  // Ficha de profissional criada JÁ vinculada ao login. Antes as duas coisas eram cadastros
  // separados: dava para ter um usuário com papel "profissional" que não existia em
  // `professionals`, e portanto não tinha fila, agenda nem horários — o vínculo era manual
  // e ninguém era obrigado a fazê-lo.
  if (input.professional) {
    const { error: profError } = await admin.from("professionals").insert({
      clinic_id: clinicId,
      user_id: userId,
      full_name: input.fullName,
      email: input.email,
      professional_register: input.professional.register,
      specialty_id: input.professional.specialtyId,
    })
    if (profError) throw profError
  }

  return userId
}

/**
 * Vincula uma ficha de profissional já existente a um login, ou cria a ficha se não houver.
 * Usado quando o profissional foi cadastrado antes de ter acesso ao sistema.
 */
export async function linkProfessionalToUser(
  supabase: DB,
  clinicId: string,
  professionalId: string,
  userId: string | null
) {
  const { error } = await supabase
    .from("professionals")
    .update({ user_id: userId })
    .eq("id", professionalId)
    .eq("clinic_id", clinicId)
  if (error) throw error
}

export async function updateMemberProfile(
  clinicId: string,
  membershipId: string,
  input: { fullName: string; roleId: string; phone: string | null }
) {
  const admin = createAdminClient()

  const { data: membership, error: readError } = await admin
    .from("clinic_memberships")
    .select("user_id")
    .eq("id", membershipId)
    .eq("clinic_id", clinicId)
    .maybeSingle()
  if (readError) throw readError
  if (!membership) throw new Error("Usuário não encontrado nesta clínica.")

  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name: input.fullName, phone: input.phone })
    .eq("id", membership.user_id)
  if (profileError) throw profileError

  const { error: roleError } = await admin
    .from("clinic_memberships")
    .update({ role_id: input.roleId })
    .eq("id", membershipId)
    .eq("clinic_id", clinicId)
  if (roleError) throw roleError

  // O nome aparece na agenda e na fila pela ficha de profissional, não pelo profile, então
  // sem isto a pessoa ficaria com dois nomes diferentes dependendo da tela.
  await admin
    .from("professionals")
    .update({ full_name: input.fullName })
    .eq("user_id", membership.user_id)
    .eq("clinic_id", clinicId)

  return membership.user_id
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

/**
 * Email of one member, resolved through this clinic's membership.
 *
 * The lookup is by membership id and re-filtered by clinic, so a caller cannot name an
 * arbitrary address: an admin of clinic A must not be able to trigger a password reset for
 * someone in clinic B, and the email must never be taken from client input. Returns null
 * when the membership does not belong to the clinic.
 */
export async function getMemberEmailForClinic(
  supabase: DB,
  clinicId: string,
  membershipId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("clinic_memberships")
    .select("profiles(email)")
    .eq("id", membershipId)
    .eq("clinic_id", clinicId)
    .maybeSingle()
  if (error) throw error

  const profile = data?.profiles as { email: string } | null | undefined
  return profile?.email ?? null
}

/**
 * Sends the standard recovery email to a member. Deliberately the *same* mechanism the
 * operator's own "esqueci minha senha" uses rather than setting a password directly:
 * an admin should never come to hold another person's password, and the recovery link
 * expires and is single-use on its own.
 */
export async function sendPasswordResetEmail(email: string, redirectTo: string) {
  const admin = createAdminClient()
  const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw error
}

/**
 * Ficha de profissional de um membro, se existir. A tela de usuários precisa distinguir três
 * situações: sem ficha, com ficha vinculada, e — o caso que gerava confusão — ficha existindo
 * com o mesmo nome mas sem `user_id`, criada antes de a pessoa ter login.
 */
export async function getProfessionalForUser(supabase: DB, clinicId: string, userId: string) {
  const { data, error } = await supabase
    .from("professionals")
    .select("id, full_name, professional_register, specialty_id, active")
    .eq("clinic_id", clinicId)
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Fichas ainda sem login vinculado — candidatas a serem ligadas a um usuário existente. */
export async function listUnlinkedProfessionals(supabase: DB, clinicId: string) {
  const { data, error } = await supabase
    .from("professionals")
    .select("id, full_name")
    .eq("clinic_id", clinicId)
    .is("user_id", null)
    .eq("active", true)
    .order("full_name")
  if (error) throw error
  return data
}

/**
 * Cria a ficha de profissional para um usuário que já existe.
 *
 * Nome e e-mail vêm do cadastro do usuário em vez de serem redigitados: são a mesma pessoa,
 * e pedir de novo é o que produz dois nomes diferentes para o mesmo indivíduo entre a tabela
 * de usuários e a agenda.
 */
export async function createProfessionalForUser(
  clinicId: string,
  userId: string,
  input: { register: string | null; specialtyId: string | null }
) {
  const admin = createAdminClient()

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle()
  if (profileError) throw profileError
  if (!profile) throw new Error("Usuário não encontrado.")

  const { data, error } = await admin
    .from("professionals")
    .insert({
      clinic_id: clinicId,
      user_id: userId,
      full_name: profile.full_name,
      email: profile.email,
      professional_register: input.register,
      specialty_id: input.specialtyId,
    })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

/**
 * Troca o e-mail de login de um membro.
 *
 * Feito pelo Admin API com `email_confirm: true`, ou seja, o endereço novo já entra
 * confirmado. A alternativa — mandar confirmação para o endereço novo — depende do SMTP do
 * projeto estar entregando, e enquanto não estiver a pessoa ficaria sem conseguir entrar por
 * nenhum dos dois endereços. Quem faz isso já tem users.manage, então a confiança é a mesma
 * que a de trocar o papel de alguém.
 */
export async function updateMemberEmail(
  clinicId: string,
  membershipId: string,
  newEmail: string
) {
  const admin = createAdminClient()

  const { data: membership, error: readError } = await admin
    .from("clinic_memberships")
    .select("user_id")
    .eq("id", membershipId)
    .eq("clinic_id", clinicId)
    .maybeSingle()
  if (readError) throw readError
  if (!membership) throw new Error("Usuário não encontrado nesta clínica.")

  const { error: authError } = await admin.auth.admin.updateUserById(membership.user_id, {
    email: newEmail,
    email_confirm: true,
  })
  if (authError) throw authError

  // profiles.email é uma cópia usada pelas telas; sem atualizar aqui a pessoa apareceria
  // com o endereço antigo em toda a gestão.
  const { error: profileError } = await admin
    .from("profiles")
    .update({ email: newEmail })
    .eq("id", membership.user_id)
  if (profileError) throw profileError

  await admin
    .from("professionals")
    .update({ email: newEmail })
    .eq("user_id", membership.user_id)
    .eq("clinic_id", clinicId)
}

/** user_ids que já possuem ficha de profissional — a tabela usa isto para só oferecer
 *  "tornar profissional" a quem ainda não tem, em vez de deixar duplicar. */
export async function listLinkedProfessionalUserIds(supabase: DB, clinicId: string) {
  const { data, error } = await supabase
    .from("professionals")
    .select("user_id")
    .eq("clinic_id", clinicId)
    .not("user_id", "is", null)
  if (error) throw error
  return new Set((data ?? []).map((r) => r.user_id as string))
}
