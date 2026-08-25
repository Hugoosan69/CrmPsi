import { NextResponse } from "next/server"

import { supabaseEnvStatus } from "@/lib/supabase/env"

export const dynamic = "force-dynamic"

/**
 * Public liveness/config probe. Exists to answer, in one request, the question that is
 * otherwise painful to diagnose on a fresh deploy: "is the app actually running, and did
 * the environment variables arrive?"
 *
 * It is safe to expose because it reports only whether each variable is PRESENT — never
 * its value, and never anything about the data.
 */
export async function GET() {
  const env = supabaseEnvStatus()
  const ready = env.url && env.anonKey && env.serviceRoleKey

  return NextResponse.json(
    {
      status: ready ? "ok" : "configuracao-incompleta",
      app: "csib",
      env: {
        NEXT_PUBLIC_SUPABASE_URL: env.url ? "definida" : "AUSENTE",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: env.anonKey ? "definida" : "AUSENTE",
        SUPABASE_SERVICE_ROLE_KEY: env.serviceRoleKey ? "definida" : "AUSENTE",
      },
      dica: ready
        ? undefined
        : "Defina as variaveis em Settings > Environment Variables na Vercel e faca um redeploy (variaveis novas nao entram em builds ja existentes).",
    },
    { status: ready ? 200 : 503 }
  )
}
