import { NextResponse, type NextRequest } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { chatMessageSchema } from "@/schemas/telehealth.schema"
import { appendMessage, listMessages, resolveInvite } from "@/services/telehealth.service"

export const dynamic = "force-dynamic"

/**
 * O chat do paciente.
 *
 * Mesma credencial da entrada na sala — o token do convite — reconferida a cada chamada, e
 * não guardada numa sessão: um link revogado no meio da consulta deixa de escrever no
 * mesmo instante.
 *
 * A identidade do remetente vem do convite (`invite:<id>`), nunca do corpo da requisição.
 * Sem isso qualquer um com o link se apresentaria como o profissional no histórico.
 */
async function autorizar(request: NextRequest, token: string) {
  const limite = rateLimit(`telehealth:chat:${clientIp(request)}`, {
    limit: 60,
    windowSeconds: 60,
  })
  if (!limite.allowed) {
    return {
      erro: NextResponse.json(
        { error: "Muitas mensagens. Aguarde um instante." },
        { status: 429, headers: { "Retry-After": String(limite.retryAfterSeconds) } }
      ),
    }
  }

  const admin = createAdminClient()
  const convite = await resolveInvite(admin, token)
  if (!convite.ok) {
    return { erro: NextResponse.json({ error: "Acesso indisponível." }, { status: 403 }) }
  }
  return { admin, convite }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const auth = await autorizar(request, token)
  if (auth.erro) return auth.erro

  const messages = await listMessages(auth.admin, auth.convite.clinicId, auth.convite.callId)
  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      senderIdentity: m.sender_identity,
      senderName: m.sender_name,
      body: m.body,
      sentAt: m.sent_at,
    })),
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const auth = await autorizar(request, token)
  if (auth.erro) return auth.erro

  const payload = await request.json().catch(() => null)
  const parsed = chatMessageSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Mensagem inválida" },
      { status: 400 }
    )
  }

  try {
    const message = await appendMessage(auth.admin, auth.convite.clinicId, {
      callId: auth.convite.callId,
      // Do convite, não do corpo: é isto que impede alguém se passar por outro.
      senderIdentity: `invite:${auth.convite.inviteId}`,
      senderName: auth.convite.displayName,
      body: parsed.data.body,
    })
    return NextResponse.json({
      message: {
        id: message.id,
        senderIdentity: message.sender_identity,
        senderName: message.sender_name,
        body: message.body,
        sentAt: message.sent_at,
      },
    })
  } catch (err) {
    console.error("falha ao gravar mensagem do chat", err)
    return NextResponse.json({ error: "Não foi possível enviar a mensagem." }, { status: 500 })
  }
}
