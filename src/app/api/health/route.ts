import { NextResponse } from "next/server"
import { headers } from "next/headers"

import { supabaseEnvStatus } from "@/lib/supabase/env"

export const dynamic = "force-dynamic"

/**
 * Public liveness/config probe. Exists to answer, in one request, the question that is
 * otherwise painful to diagnose on a fresh deploy: "is the app actually running, and did
 * the environment variables arrive?"
 *
 * Reporta o VALOR das variáveis públicas, não só a presença.
 *
 * A versão anterior dizia apenas "definida", e isso custou caro: a URL do Supabase estava
 * gravada com dois erros de digitação (`h` no lugar de `b` e um `v` faltando), apontando
 * para um domínio inexistente. Login, recuperação de senha e a logo falhavam todos, e este
 * endpoint respondia "ok" o tempo todo, porque a variável de fato existia. Presença não é
 * a pergunta útil — o valor é.
 *
 * Expor estes dois é seguro: ambos são NEXT_PUBLIC_, ou seja, já vão embutidos no bundle
 * que qualquer visitante baixa. A service role key continua apenas como presença, porque
 * essa sim é secreta.
 */
export async function GET() {
  const env = supabaseEnvStatus()
  const ready = env.url && env.anonKey && env.serviceRoleKey

  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const proto = h.get("x-forwarded-proto") ?? "https"
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

  return NextResponse.json(
    {
      status: ready ? "ok" : "configuracao-incompleta",
      app: "csib",
      env: {
        // Valor completo: é público e é justamente o que precisa ser conferido.
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "AUSENTE",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: env.anonKey ? "definida" : "AUSENTE",
        SUPABASE_SERVICE_ROLE_KEY: env.serviceRoleKey ? "definida" : "AUSENTE",
        NEXT_PUBLIC_SITE_URL: siteUrl ?? "(nao definida - deduzida do request)",
      },
      // Para onde os links de recuperação de senha vão apontar. Confira que este endereço
      // está na allowlist do Supabase (Authentication > URL Configuration > Redirect URLs),
      // senão ele cai calado no Site URL do projeto.
      redirecionamentoDeSenha: `${siteUrl?.replace(/\/$/, "") ?? `${proto}://${host}`}/redefinir-senha`,
      dica: ready
        ? undefined
        : "Defina as variaveis em Settings > Environment Variables na Vercel e faca um redeploy (variaveis novas nao entram em builds ja existentes).",
    },
    { status: ready ? 200 : 503 }
  )
}
