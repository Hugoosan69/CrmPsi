import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import type { Database } from "@/types/supabase"
import { supabaseEnv } from "./env"
import { isSandboxMode, createSandboxClient } from "./sandbox"

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 *
 * Quando o sandbox está ON, devolve um cliente de service-role apontado para o banco de
 * homologação. A autenticação do usuário (JWT, sessão) continua no banco de produção —
 * quem faz essa parte é `createAuthClient`, usado internamente por `session.ts`.
 *
 * Isso funciona porque todas as verificações de permissão (`requirePermission`) acontecem
 * no app, antes de qualquer operação de dados. O service-role ignora RLS no sandbox, mas
 * a camada de aplicação já garante que o usuário tem permissão.
 */
export async function createClient() {
  if (await isSandboxMode()) {
    return createSandboxClient()
  }
  return createAuthClient()
}

/**
 * Cliente sempre conectado ao banco de produção, com a sessão do usuário. Usado
 * exclusivamente pelo DAL de autenticação (`session.ts`) para `auth.getUser()` e leitura
 * de permissões — nunca para operações de dados de domínio.
 */
export async function createAuthClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(supabaseEnv.url, supabaseEnv.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Called from a Server Component render (not an Action/Route Handler) —
          // safe to ignore as long as proxy.ts refreshes the session cookie.
        }
      },
    },
  })
}
