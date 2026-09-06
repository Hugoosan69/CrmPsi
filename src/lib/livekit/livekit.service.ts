import "server-only"

import { AccessToken, RoomServiceClient, WebhookReceiver } from "livekit-server-sdk"

import { livekitEnv } from "./env"

/**
 * A única porta de entrada do SDK do LiveKit neste projeto.
 *
 * Tudo que exige `LIVEKIT_API_SECRET` passa por aqui — emitir token, encerrar sala,
 * conferir webhook. Concentrar num arquivo é o que torna verificável a regra que mais
 * importa nesta feature: **o segredo nunca sai do servidor**. Se algum dia alguém precisar
 * auditar isso, é este arquivo que se lê, e nenhum outro.
 *
 * Nada aqui aceita `room` ou `identity` vindos do navegador. Quem chama já resolveu, no
 * servidor, de quem é a sessão e a que consulta ela dá direito.
 */

/** 15 minutos para ENTRAR. Uma sessão já conectada não cai quando o token expira. */
const JOIN_TTL_SECONDS = 15 * 60

export type LiveKitGrantRole = "atendente" | "cliente"

function roomService() {
  // A URL de sinalização é `wss://`; a API HTTP do mesmo projeto é `https://`.
  const httpUrl = livekitEnv.url.replace(/^ws/, "http")
  return new RoomServiceClient(httpUrl, livekitEnv.apiKey, livekitEnv.apiSecret)
}

/**
 * Token de acesso a uma sala.
 *
 * `identity` é montada pelo chamador a partir do usuário ou do convite (`user:<id>` /
 * `invite:<id>`), nunca de input — é ela que o LiveKit usa como chave do participante e
 * que volta no webhook para dizer quem entrou.
 *
 * Os grants são o mínimo que uma consulta precisa: entrar, publicar áudio/vídeo/tela,
 * assinar o do outro e trocar dados (o chat). Ninguém recebe `roomAdmin` nem `roomCreate` —
 * nem o atendente, que encerra a sala pelo servidor, e não pelo navegador.
 */
export async function issueAccessToken(input: {
  roomName: string
  identity: string
  displayName: string
  role: LiveKitGrantRole
}): Promise<string> {
  const token = new AccessToken(livekitEnv.apiKey, livekitEnv.apiSecret, {
    identity: input.identity,
    name: input.displayName,
    ttl: JOIN_TTL_SECONDS,
  })

  token.addGrant({
    roomJoin: true,
    room: input.roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  })

  return token.toJwt()
}

/**
 * Encerra a sala para todos.
 *
 * O LiveKit cria a sala sozinho quando o primeiro participante entra, então não há
 * "criar" — há destruir, que é o que efetivamente tira as duas pontas da linha. Erro aqui
 * não é fatal: se a sala já não existe (todos saíram), o efeito desejado já aconteceu.
 */
export async function closeRoom(roomName: string): Promise<void> {
  try {
    await roomService().deleteRoom(roomName)
  } catch (err) {
    // `deleteRoom` numa sala inexistente é justamente o estado que se queria alcançar.
    console.error("livekit deleteRoom falhou (sala provavelmente já encerrada)", err)
  }
}

/**
 * Confere a assinatura de um webhook do LiveKit e devolve o evento.
 *
 * Sem isto o endereço é público e sem autenticação: qualquer um que o descubra posta um
 * `room_finished` e encerra a consulta alheia, ou um `participant_joined` e polui o
 * histórico de quem esteve na sala. O corpo continua sendo dado não confiável mesmo depois
 * de assinado — assinatura prova a origem, não o conteúdo.
 */
export async function parseWebhookEvent(rawBody: string, authHeader: string | null) {
  if (!authHeader) throw new Error("Webhook sem cabeçalho de autorização.")
  const receiver = new WebhookReceiver(livekitEnv.apiKey, livekitEnv.apiSecret)
  return receiver.receive(rawBody, authHeader)
}
