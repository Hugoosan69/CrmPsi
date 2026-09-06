import { NextResponse, type NextRequest } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { livekitEnvStatus } from "@/lib/livekit/env"
import { parseWebhookEvent } from "@/lib/livekit/livekit.service"
import {
  getCallByRoomName,
  recordParticipantJoined,
  recordParticipantLeft,
  setCallStatus,
} from "@/services/telehealth.service"
import { notify, profileIdsForProfessionals } from "@/services/notifications.service"
import type { VideoCallRole } from "@/types/supabase"

export const dynamic = "force-dynamic"

/**
 * Webhook do LiveKit.
 *
 * É por aqui que o CSIB fica sabendo o que aconteceu de fato dentro da sala. Até agora o
 * sistema só sabia o que ele mesmo mandou fazer: `started_at` era aproximado pela emissão
 * do token do profissional, e a lista de quem esteve na sala ficava vazia. Quem sabe a
 * verdade é o servidor de mídia, e é ele que fala aqui.
 *
 * Conferir a assinatura é o que separa este endereço de um formulário público: sem ela,
 * qualquer um que descubra a URL encerra a consulta alheia com um `room_finished`, ou polui
 * o histórico de participantes. O corpo continua sendo dado não confiável mesmo assinado —
 * assinatura prova a origem, não o conteúdo.
 *
 * Configurar em https://cloud.livekit.io › Settings › Webhooks apontando para
 * https://csibrasilia.club/api/integrations/livekit/webhook
 *
 * Códigos de resposta importam: o LiveKit reenvia o que não recebeu 2xx. Evento que nunca
 * vamos tratar responde 200 (reenviar não ajuda); falha ao gravar responde 500, porque aí
 * a retentativa é justamente o que se quer.
 */

/** A identidade diz o papel — foi o servidor que a montou ao emitir o token. */
function papelDaIdentidade(identity: string): VideoCallRole {
  if (identity.startsWith("invite:")) return "cliente"
  if (identity.startsWith("user:")) return "atendente"
  return "supervisor"
}

/** O LiveKit manda segundos; o banco guarda timestamptz. */
function comoIso(segundos: number | bigint | undefined): string {
  if (segundos === undefined) return new Date().toISOString()
  return new Date(Number(segundos) * 1000).toISOString()
}

export async function POST(request: NextRequest) {
  const status = livekitEnvStatus()
  if (!status.apiKey || !status.apiSecret) {
    // 503 e não 500: a teleconsulta não estar configurada é um estado legítimo.
    return NextResponse.json({ error: "LiveKit não configurado." }, { status: 503 })
  }

  // Corpo CRU: a assinatura cobre os bytes exatos que o LiveKit enviou, e um parse seguido
  // de stringify reordena chaves e invalida a conferência.
  const rawBody = await request.text()

  let event
  try {
    event = await parseWebhookEvent(rawBody, request.headers.get("Authorization"))
  } catch (err) {
    console.error("webhook do livekit com assinatura inválida", err)
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 })
  }

  const roomName = event.room?.name
  if (!roomName) return NextResponse.json({ received: true })

  const admin = createAdminClient()

  let call
  try {
    call = await getCallByRoomName(admin, roomName)
  } catch (err) {
    console.error("webhook: falha ao localizar a chamada", err)
    return NextResponse.json({ error: "erro ao localizar a chamada" }, { status: 500 })
  }

  // Sala que não é nossa (ou já apagada): 200, porque reenviar não vai mudar isso.
  if (!call) return NextResponse.json({ received: true, ignored: "sala desconhecida" })

  try {
    switch (event.event) {
      case "room_started": {
        // Só avança a partir de `aguardando`: um reenvio depois do encerramento não pode
        // ressuscitar a consulta.
        if (call.status === "aguardando") {
          await setCallStatus(admin, call.clinic_id, call.id, "em_andamento", {
            startedAt: comoIso(event.createdAt),
          })
        }
        break
      }

      case "participant_joined": {
        const identity = event.participant?.identity
        if (!identity) break

        const papel = papelDaIdentidade(identity)
        await recordParticipantJoined(admin, {
          clinicId: call.clinic_id,
          callId: call.id,
          identity,
          displayName: event.participant?.name ?? null,
          papel,
          joinedAt: comoIso(event.createdAt),
        })

        // Sala de espera: o paciente chegou e talvez não haja ninguém do outro lado. O
        // profissional precisa saber sem estar olhando para a tela da chamada.
        if (papel === "cliente") await avisarProfissional(admin, call.id, call.clinic_id)
        break
      }

      case "participant_left": {
        const identity = event.participant?.identity
        if (!identity) break
        await recordParticipantLeft(admin, {
          callId: call.id,
          identity,
          leftAt: comoIso(event.createdAt),
        })
        break
      }

      case "room_finished": {
        if (call.status !== "encerrada" && call.status !== "cancelada") {
          await setCallStatus(admin, call.clinic_id, call.id, "encerrada", {
            endedAt: comoIso(event.createdAt),
          })
        }
        break
      }

      default:
        // Evento que não tratamos. 200: nunca vamos tratá-lo, reenviar não ajuda.
        return NextResponse.json({ received: true, ignored: event.event })
    }
  } catch (err) {
    console.error(`webhook do livekit falhou ao tratar ${event.event}`, err)
    return NextResponse.json({ error: "erro ao gravar" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

/**
 * Avisa quem vai atender que o paciente entrou na sala.
 *
 * Caminho todo por chave: chamada → entrada de fila → profissional → perfil. Um
 * profissional sem login vinculado simplesmente não tem quem notificar, e `notify` já
 * trata isso — a falta de aviso nunca derruba o webhook, que é o que mantém o histórico
 * da chamada correto mesmo quando a notificação não sai.
 */
async function avisarProfissional(
  admin: ReturnType<typeof createAdminClient>,
  callId: string,
  clinicId: string
) {
  try {
    const { data: call } = await admin
      .from("video_calls")
      .select("queue_entry_id")
      .eq("id", callId)
      .maybeSingle()
    if (!call) return

    const { data: entry } = await admin
      .from("queue_entries")
      .select("professional_id, patient_id")
      .eq("id", call.queue_entry_id)
      .maybeSingle()
    if (!entry?.professional_id) return

    const [{ data: patient }, destinatarios] = await Promise.all([
      admin.from("patients").select("full_name, social_name").eq("id", entry.patient_id).maybeSingle(),
      profileIdsForProfessionals(admin, clinicId, [entry.professional_id]),
    ])

    const nome = patient?.social_name || patient?.full_name || "O paciente"

    await notify({
      clinicId,
      userIds: destinatarios,
      kind: "queue",
      title: `${nome} entrou na sala de vídeo`,
      body: "O paciente está aguardando na teleconsulta.",
      href: `/profissional/chamada/${callId}`,
      entityType: "video_call",
      entityId: callId,
    })
  } catch (err) {
    console.error("webhook: falha ao avisar o profissional", err)
  }
}
