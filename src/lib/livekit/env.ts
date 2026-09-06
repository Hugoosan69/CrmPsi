/**
 * Credenciais do LiveKit.
 *
 * Mesmo tratamento das do Stripe, e pela mesma razão: `LIVEKIT_API_SECRET` assina os tokens
 * que dão acesso à sala de uma consulta. Quem tem o segredo entra em qualquer atendimento
 * da clínica, como qualquer pessoa, sem passar por login nenhum — é credencial de nível de
 * deploy, não de tela, e por isso não mora em `clinic_settings`.
 *
 * As TRÊS são server-only, a URL inclusive. O navegador precisa dela para conectar, mas
 * recebe-a do servidor junto com o token (é o `serverUrl` que a action e o endpoint do
 * convite devolvem) — assim ela não entra no bundle, e um `NEXT_PUBLIC_` a menos é uma
 * coisa a menos que alguém pode confundir com "pode ser público".
 */
const URL_SINALIZACAO = process.env.LIVEKIT_URL

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing ${name}. Configure as credenciais do LiveKit no ambiente.`)
  }
  return value
}

/** Presença, nunca valores — pode ser exposto pelo /api/health. */
export function livekitEnvStatus() {
  return {
    url: Boolean(URL_SINALIZACAO),
    apiKey: Boolean(process.env.LIVEKIT_API_KEY),
    apiSecret: Boolean(process.env.LIVEKIT_API_SECRET),
    webhookConfigured: Boolean(process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET),
  }
}

/**
 * Mínimo para abrir uma sala. Sem isto o módulo de teleconsulta se anuncia como
 * indisponível em vez de estourar — a clínica que ainda não contratou o LiveKit continua
 * usando o resto do sistema normalmente.
 */
export function isLiveKitConfigured() {
  return Boolean(URL_SINALIZACAO && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET)
}

// Lidas só quando alguém realmente vai falar com o LiveKit, nunca na importação.
export const livekitEnv = {
  get url() {
    return required(URL_SINALIZACAO, "LIVEKIT_URL")
  },
  get apiKey() {
    return required(process.env.LIVEKIT_API_KEY, "LIVEKIT_API_KEY")
  },
  get apiSecret() {
    return required(process.env.LIVEKIT_API_SECRET, "LIVEKIT_API_SECRET")
  },
}

/**
 * A URL de sinalização, para o componente de sala receber junto com o token.
 * `null` quando não configurada. Chamada só do servidor.
 */
export function livekitPublicUrl(): string | null {
  return URL_SINALIZACAO ?? null
}
