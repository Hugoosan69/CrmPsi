import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/supabase"
import { getClinicSettings } from "./clinic-settings.service"
import type { Json } from "@/types/supabase"

type DB = SupabaseClient<Database>

/**
 * Integração com o WAHA (WhatsApp HTTP API).
 *
 * O WAHA roda numa VPS da clínica e mantém a sessão do WhatsApp — é ele que segura o número
 * conectado. Este módulo só conversa com ele pelo servidor, nunca pelo navegador: a chave de
 * API dá controle total sobre a conta de WhatsApp da clínica, e mandá-la para o cliente a
 * deixaria visível para qualquer pessoa com o inspetor aberto.
 *
 * Endpoints conferidos contra a instância real (WAHA 2026.8.1, engine WEBJS):
 *   GET  /api/sessions                    lista
 *   POST /api/sessions                    cria  { name, start, config }
 *   GET  /api/sessions/{name}             estado (SessionInfo: name, me, status)
 *   POST /api/sessions/{name}/start|stop|logout|restart   (restart recupera sessão FAILED)
 *   GET  /api/{name}/auth/qr?format=image QR para parear
 *   POST /api/sendText                    { chatId, text, session }
 * Autenticação por cabeçalho X-Api-Key.
 */

export type WahaConfig = {
  enabled: boolean
  /** Ex.: http://64.181.189.174:3000 */
  baseUrl: string
  /** Nome da sessão no WAHA. "default" serve para uma clínica só. */
  session: string
  /** Nunca serializada para o navegador. */
  apiKey: string | null
}

export const DEFAULT_WAHA: WahaConfig = {
  enabled: false,
  baseUrl: "",
  session: "default",
  apiKey: null,
}

function coerceWaha(raw: unknown): WahaConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_WAHA }
  const v = raw as Partial<WahaConfig>
  return {
    enabled: v.enabled === true,
    baseUrl: typeof v.baseUrl === "string" ? v.baseUrl.trim().replace(/\/+$/, "") : "",
    session: typeof v.session === "string" && v.session ? v.session : "default",
    apiKey: typeof v.apiKey === "string" && v.apiKey ? v.apiKey : null,
  }
}

export async function getWahaConfig(supabase: DB, clinicId: string): Promise<WahaConfig> {
  const settings = await getClinicSettings(supabase, clinicId)
  const integrations = (settings as { integrations?: { waha?: unknown } }).integrations
  return coerceWaha(integrations?.waha)
}

export async function saveWahaConfig(
  supabase: DB,
  clinicId: string,
  input: { enabled: boolean; baseUrl: string; session: string; apiKey?: string | null }
) {
  const current = await getClinicSettings(supabase, clinicId)
  const integrations = (current as { integrations?: Record<string, unknown> }).integrations ?? {}
  const currentWaha = coerceWaha(integrations.waha)

  const next = {
    ...current,
    integrations: {
      ...integrations,
      waha: {
        enabled: input.enabled,
        baseUrl: input.baseUrl.trim().replace(/\/+$/, ""),
        session: input.session.trim() || "default",
        // undefined mantém a chave gravada — é o que deixa o campo ser exibido mascarado e
        // só sobrescrito quando o operador digita uma nova.
        apiKey: input.apiKey === undefined ? currentWaha.apiKey : input.apiKey,
      },
    },
  }

  const { error } = await supabase
    .from("clinic_settings")
    .upsert({ clinic_id: clinicId, settings: next as unknown as Json })
  if (error) throw error
}

function headers(config: WahaConfig): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" }
  if (config.apiKey) h["X-Api-Key"] = config.apiKey
  return h
}

export type WahaStatus = {
  reachable: boolean
  /** STOPPED | STARTING | SCAN_QR_CODE | WORKING | FAILED — vocabulário do WAHA. */
  status: string | null
  /** Número conectado, quando há sessão ativa. */
  me: { id: string; pushName?: string } | null
  error: string | null
}

/**
 * Estado da sessão. Nunca lança: esta função alimenta uma tela de configuração, e um WAHA
 * fora do ar precisa aparecer como "inacessível" e não derrubar a página inteira.
 */
export async function getWahaStatus(config: WahaConfig): Promise<WahaStatus> {
  if (!config.baseUrl) {
    return { reachable: false, status: null, me: null, error: "Servidor não configurado." }
  }

  try {
    const response = await fetch(
      `${config.baseUrl}/api/sessions/${encodeURIComponent(config.session)}`,
      { headers: headers(config), signal: AbortSignal.timeout(10_000), cache: "no-store" }
    )

    if (response.status === 404) {
      return { reachable: true, status: "NOT_CREATED", me: null, error: null }
    }
    if (!response.ok) {
      return {
        reachable: true,
        status: null,
        me: null,
        error: `O WAHA respondeu ${response.status}.`,
      }
    }

    const data = (await response.json()) as { status?: string; me?: { id: string } | null }
    return {
      reachable: true,
      status: data.status ?? null,
      me: data.me ?? null,
      error: null,
    }
  } catch (err) {
    console.error("waha: status falhou", err)
    return {
      reachable: false,
      status: null,
      me: null,
      error: "Não foi possível falar com o servidor WAHA. Verifique o endereço e se ele está no ar.",
    }
  }
}

/** Cria a sessão se não existir e inicia. Idempotente: chamar com sessão já criada só inicia. */
export async function startWahaSession(config: WahaConfig) {
  const base = config.baseUrl
  const name = config.session

  const existing = await fetch(`${base}/api/sessions/${encodeURIComponent(name)}`, {
    headers: headers(config),
    signal: AbortSignal.timeout(10_000),
  })

  if (existing.status === 404) {
    const created = await fetch(`${base}/api/sessions`, {
      method: "POST",
      headers: headers(config),
      // start: true já sobe a sessão, evitando um segundo round trip só para iniciar.
      body: JSON.stringify({ name, start: true }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!created.ok) throw new Error(`Falha ao criar a sessão: ${await created.text()}`)
    return
  }

  // Sessão com falha NÃO volta com /start. Conferido contra a instância: com a sessão em
  // FAILED, o WAHA responde ao pedido de QR com 422 "restart the session", e /start é
  // idempotente — para ele a sessão já existe, então não há o que fazer. /restart derruba o
  // navegador interno e sobe de novo, e é o que leva a sessão de volta a SCAN_QR_CODE.
  //
  // Era o beco sem saída da tela: a sessão falhava, o botão chamava /start, nada mudava, e o
  // QR nunca aparecia porque a tela só o busca quando o status é SCAN_QR_CODE.
  const atual = existing.ok ? ((await existing.json()) as { status?: string }) : {}
  const rota = atual.status === "FAILED" ? "restart" : "start"

  const started = await fetch(`${base}/api/sessions/${encodeURIComponent(name)}/${rota}`, {
    method: "POST",
    headers: headers(config),
    signal: AbortSignal.timeout(20_000),
  })
  // 422 aqui costuma ser "já está rodando", que não é erro do ponto de vista do operador.
  if (!started.ok && started.status !== 422) {
    throw new Error(`Falha ao ${rota === "restart" ? "reiniciar" : "iniciar"} a sessão: ${await started.text()}`)
  }
}

/** Desconecta o número. Diferente de parar: logout exige novo QR para reconectar. */
export async function logoutWahaSession(config: WahaConfig) {
  const response = await fetch(
    `${config.baseUrl}/api/sessions/${encodeURIComponent(config.session)}/logout`,
    { method: "POST", headers: headers(config), signal: AbortSignal.timeout(15_000) }
  )
  if (!response.ok) throw new Error(`Falha ao desconectar: ${await response.text()}`)
}

/**
 * QR já embutido como data URI.
 *
 * Devolvido em base64 e não como URL de imagem por dois motivos. O navegador do operador
 * pode não alcançar a VPS do WAHA — ela costuma estar numa rede interna, e um `<img>`
 * apontando direto para lá mostraria imagem quebrada. E a chave de API precisa ficar no
 * servidor: quem busca é o servidor, o cliente recebe só os pixels.
 *
 * `format=image` é o único que devolve imagem; `format=raw` devolve o texto do QR, que
 * exigiria uma biblioteca de renderização no cliente para nada.
 */
export async function fetchWahaQrDataUri(config: WahaConfig): Promise<string | null> {
  if (!config.baseUrl) return null

  try {
    const response = await fetch(
      `${config.baseUrl}/api/${encodeURIComponent(config.session)}/auth/qr?format=image`,
      {
        headers: { ...headers(config), Accept: "image/png" },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      }
    )
    // Sem QR normalmente significa sessão já conectada ou ainda subindo — não é erro, e a
    // tela distingue os dois pelo status.
    if (!response.ok) return null

    const buffer = Buffer.from(await response.arrayBuffer())
    const type = response.headers.get("content-type") ?? "image/png"
    return `data:${type};base64,${buffer.toString("base64")}`
  } catch (err) {
    console.error("waha: QR falhou", err)
    return null
  }
}

/**
 * Descobre o identificador de conversa de um número, perguntando ao WhatsApp.
 *
 * O formato clássico é `<numero>@c.us`, mas o WhatsApp passou a endereçar contas por LID
 * (`<id>@lid`), e o WEBJS não resolve `@c.us` de quem a sessão ainda não conhece: o envio
 * falha com "WAHA 500: No LID for user". Enviar para o próprio número da clínica funcionava
 * — ele já é conhecido —, e foi por isso que o defeito passou pelo primeiro teste.
 *
 * `check-exists` devolve o `chatId` correto e, de quebra, diz se o número tem WhatsApp, o
 * que vira um erro legível em vez de um 500 do motor.
 */
async function resolveChatId(config: WahaConfig, withCountry: string): Promise<string> {
  const url = `${config.baseUrl}/api/contacts/check-exists?phone=${withCountry}&session=${encodeURIComponent(config.session)}`
  const response = await fetch(url, { headers: headers(config), signal: AbortSignal.timeout(15_000) })

  if (!response.ok) {
    // O WAHA pode não expor a checagem (versão antiga). Segue com o formato clássico, que
    // é o que sempre funcionou para contato já conhecido pela sessão.
    return `${withCountry}@c.us`
  }

  const data = (await response.json()) as { numberExists?: boolean; chatId?: string }
  if (data.numberExists === false) {
    throw new Error("Este número não tem WhatsApp.")
  }
  return data.chatId || `${withCountry}@c.us`
}

/**
 * Envia uma mensagem de texto.
 *
 * O número é normalizado com DDI e sem símbolos — "(61) 99869-4211" vira "5561998694211" —
 * e o destino é resolvido por `resolveChatId`, não montado à mão.
 */
export async function sendWahaText(config: WahaConfig, phone: string, text: string) {
  const digits = phone.replace(/\D/g, "")
  // Número brasileiro sem DDI: 10 (fixo) ou 11 (celular) dígitos. Prefixa 55.
  const withCountry = digits.length <= 11 ? `55${digits}` : digits
  const chatId = await resolveChatId(config, withCountry)

  const response = await fetch(`${config.baseUrl}/api/sendText`, {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify({
      session: config.session,
      chatId,
      text,
    }),
    signal: AbortSignal.timeout(20_000),
  })

  const body = await response.text()
  if (!response.ok) throw new Error(`WAHA ${response.status}: ${body.slice(0, 300)}`)
  return body
}

/**
 * Normaliza um telefone para o formato internacional que o WhatsApp espera: só dígitos, com
 * DDI, sem símbolos. Um número brasileiro digitado como "(61) 99869-4211" precisa virar
 * "5561998694211".
 */
export function toInternational(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  // 10 (fixo) ou 11 (celular) dígitos = número nacional sem DDI.
  return digits.length <= 11 ? `55${digits}` : digits
}

/**
 * Pede o código de pareamento, alternativa ao QR.
 *
 * Com `method` ausente o WAHA faz o "web pairing": devolve um código curto que a pessoa
 * digita no próprio WhatsApp (Aparelhos conectados › Conectar com número de telefone). É
 * mais prático que o QR quando o celular está na mão de quem está mexendo no sistema — não
 * exige apontar a câmera para outra tela.
 *
 * O formato da resposta NÃO está documentado no OpenAPI da instância, e não foi verificado
 * contra o servidor porque pedir um código dispara uma notificação real no WhatsApp do
 * número informado. Por isso a leitura aceita as formas plausíveis em vez de assumir uma:
 * se vier algo inesperado, o texto cru é devolvido para a tela mostrar em vez de falhar.
 */
export async function requestWahaPairingCode(
  config: WahaConfig,
  phone: string
): Promise<string> {
  const response = await fetch(
    `${config.baseUrl}/api/${encodeURIComponent(config.session)}/auth/request-code`,
    {
      method: "POST",
      headers: headers(config),
      // `method` omitido de propósito: preenchê-lo com sms/voice pede o código de
      // REGISTRO de uma conta nova, que é outro fluxo — aqui a conta já existe e só está
      // sendo vinculada a este aparelho.
      body: JSON.stringify({ phoneNumber: toInternational(phone) }),
      signal: AbortSignal.timeout(20_000),
    }
  )

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`WAHA ${response.status}: ${text.slice(0, 300)}`)
  }

  try {
    const data = JSON.parse(text) as Record<string, unknown>
    const code =
      data.code ??
      (data.data as Record<string, unknown> | undefined)?.code ??
      data.pairingCode ??
      data.value
    if (typeof code === "string" && code) return code
  } catch {
    // Resposta em texto puro: devolvida como veio.
  }

  return text.trim().slice(0, 40)
}
