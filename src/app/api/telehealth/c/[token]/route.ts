import { NextResponse, type NextRequest } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { isLiveKitConfigured, livekitPublicUrl } from "@/lib/livekit/env"
import { issueAccessToken } from "@/lib/livekit/livekit.service"
import { markInviteUsed, resolveInvite } from "@/services/telehealth.service"

export const dynamic = "force-dynamic"

/**
 * Entrada do paciente na teleconsulta.
 *
 * É o único endereço deste módulo que atende quem NÃO tem sessão no CSIB, e por isso
 * concentra toda a autorização do lado do paciente:
 *
 * 1. O token do link é a credencial inteira. Não há usuário, senha nem cookie — quem tem o
 *    link entra. Daí ele ser aleatório de 256 bits, guardado só como hash, com validade e
 *    revogação.
 * 2. `room` e `identity` são resolvidos AQUI, a partir do convite. Nada do que o navegador
 *    manda entra no token — é precisamente a falha que a spec manda corrigir em relação ao
 *    protótipo.
 * 3. Rate limit por IP: sem ele, o endereço é um oráculo para adivinhar tokens.
 *
 * A leitura usa a service role porque nenhuma policy cobre um visitante anônimo; a
 * autorização é `resolveInvite`, e é ela que decide se existe resposta.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const limite = rateLimit(`telehealth:invite:${clientIp(request)}`, {
    limit: 20,
    windowSeconds: 60,
  })
  if (!limite.allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde um instante." },
      { status: 429, headers: { "Retry-After": String(limite.retryAfterSeconds) } }
    )
  }

  if (!isLiveKitConfigured()) {
    return NextResponse.json(
      { error: "Teleconsulta indisponível neste ambiente." },
      { status: 503 }
    )
  }

  const { token } = await params
  const admin = createAdminClient()

  let convite
  try {
    convite = await resolveInvite(admin, token)
  } catch (err) {
    console.error("falha ao resolver convite de teleconsulta", err)
    return NextResponse.json({ error: "Não foi possível validar o convite." }, { status: 500 })
  }

  if (!convite.ok) {
    // Mensagem por motivo: o paciente precisa saber se pede outro link ou se chegou tarde.
    // Nenhuma delas revela se o token existiu — "não encontrado" e "revogado" são
    // deliberadamente o mesmo 404 para quem está adivinhando.
    const mensagens: Record<typeof convite.reason, { status: number; error: string }> = {
      not_found: { status: 404, error: "Link inválido. Peça um novo à clínica." },
      revoked: { status: 404, error: "Link inválido. Peça um novo à clínica." },
      expired: { status: 410, error: "Este link expirou. Peça um novo à clínica." },
      call_ended: { status: 410, error: "Esta consulta já foi encerrada." },
    }
    const { status, error } = mensagens[convite.reason]
    return NextResponse.json({ error }, { status })
  }

  const accessToken = await issueAccessToken({
    roomName: convite.roomName,
    identity: `invite:${convite.inviteId}`,
    displayName: convite.displayName,
    role: "cliente",
  })

  // Registra o primeiro acesso; não invalida o link — o paciente pode cair e voltar.
  await markInviteUsed(admin, convite.inviteId).catch((err) =>
    console.error("falha ao marcar convite como usado", err)
  )

  return NextResponse.json({
    token: accessToken,
    serverUrl: livekitPublicUrl(),
    roomName: convite.roomName,
    displayName: convite.displayName,
    callId: convite.callId,
  })
}
