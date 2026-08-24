"use server"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getCurrentMembership } from "@/lib/auth/session"
import { defaultHomeForRole } from "@/config/roles"
import { loginSchema } from "@/schemas/auth.schema"

export type LoginState = { error?: string }

export async function signIn(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    return { error: "E-mail ou senha inválidos." }
  }

  const membership = await getCurrentMembership()
  if (!membership) {
    await supabase.auth.signOut()
    return { error: "Este usuário não está vinculado a nenhuma clínica ativa." }
  }

  redirect(defaultHomeForRole(membership.roleSlug))
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
