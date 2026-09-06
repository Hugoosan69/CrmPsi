/**
 * Credenciais do LiveKit.
 *
 * Mesmo tratamento das do Stripe, e pela mesma razão: `LIVEKIT_API_SECRET` assina os tokens
 * que dão acesso à sala de uma consulta. Quem tem o segredo entra em qualquer atendimento
 * da clínica, como qualquer pessoa, sem passar por login nenhum — é credencial de nível de
 * deploy, não de tela, e por isso não mora em `clinic_settings`.
 *
 * A URL é a única que o navegador precisa conhecer (é para onde o cliente WebRTC conecta),
 * e por isso é exposta como `NEXT_PUBLIC_`. Lida como literal estático de propósito:
 * `process.env[nome]` NÃO é substituído pelo bundler e chegaria `undefined` no navegador —
 * o mesmo defeito que já derrubou a tela de redefinição de senha.
 */
const PUBLIC_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing ${name}. Configure as credenciais do LiveKit no ambiente.`)
  }
  return value
}

/** Presença, nunca valores — pode ser exposto pelo /api/health. */
export function livekitEnvStatus() {
  return {
    url: Boolean(PUBLIC_URL),
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
  return Boolean(PUBLIC_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET)
}

// Lidas só quando alguém realmente vai falar com o LiveKit, nunca na importação.
export const livekitEnv = {
  get url() {
    return required(PUBLIC_URL, "NEXT_PUBLIC_LIVEKIT_URL")
  },
  get apiKey() {
    return required(process.env.LIVEKIT_API_KEY, "LIVEKIT_API_KEY")
  },
  get apiSecret() {
    return required(process.env.LIVEKIT_API_SECRET, "LIVEKIT_API_SECRET")
  },
}

/** A URL pública, para o componente de sala. `null` quando não configurada. */
export function livekitPublicUrl(): string | null {
  return PUBLIC_URL ?? null
}
