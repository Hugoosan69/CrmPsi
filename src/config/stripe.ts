/**
 * Peças puras da integração com o Stripe — sem `server-only`, sem rede, sem banco.
 *
 * Separadas do serviço para poderem ser exercitadas isoladamente: conversão de valores e
 * leitura da assinatura do webhook são exatamente o tipo de código onde um erro silencioso
 * custa dinheiro ou deixa entrar evento forjado.
 */

/** Eventos que o webhook trata. Qualquer outro é reconhecido com 200 e ignorado — devolver
 *  erro faria o Stripe reenviar indefinidamente algo que nunca vamos processar. */
export const STRIPE_HANDLED_EVENTS = [
  "checkout.session.completed",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "charge.refunded",
] as const

export type StripeHandledEvent = (typeof STRIPE_HANDLED_EVENTS)[number]

export function isHandledEvent(type: string): type is StripeHandledEvent {
  return (STRIPE_HANDLED_EVENTS as readonly string[]).includes(type)
}

/**
 * Reais → centavos.
 *
 * O Stripe trabalha só com inteiros na menor unidade da moeda. `Math.round` é obrigatório:
 * `amount * 100` sobre um numeric(10,2) que virou float dá 1899.9999999999998 para 18.99, e
 * um `Math.trunc` cobraria um centavo a menos em boa parte dos valores.
 */
export function toStripeAmount(amount: number): number {
  return Math.round(amount * 100)
}

/** Centavos → reais, com duas casas. */
export function fromStripeAmount(amount: number): number {
  return Math.round(amount) / 100
}

export type StripeSignature = {
  /** Carimbo de tempo do evento, em segundos. */
  timestamp: number
  /** Assinaturas do esquema v1 — pode haver mais de uma durante rotação de segredo. */
  signatures: string[]
}

/**
 * Lê o cabeçalho `Stripe-Signature`, no formato `t=1699999999,v1=abc...,v1=def...`.
 *
 * Devolve null para qualquer coisa que não case com o formato, em vez de um objeto vazio:
 * quem chama precisa distinguir "cabeçalho inválido" de "nenhuma assinatura conferiu", e um
 * objeto com lista vazia passaria por um `if` desatento.
 */
export function parseStripeSignature(header: string | null): StripeSignature | null {
  if (!header) return null

  let timestamp: number | null = null
  const signatures: string[] = []

  for (const part of header.split(",")) {
    const index = part.indexOf("=")
    if (index === -1) continue
    const key = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    if (key === "t") {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) timestamp = parsed
    } else if (key === "v1" && value) {
      signatures.push(value)
    }
  }

  if (timestamp === null || signatures.length === 0) return null
  return { timestamp, signatures }
}

/** O que é assinado: `<timestamp>.<corpo cru>`. O corpo tem de ser o texto exato recebido —
 *  um JSON.parse seguido de stringify muda a ordem das chaves e invalida a conferência. */
export function signedPayload(timestamp: number, rawBody: string): string {
  return `${timestamp}.${rawBody}`
}

/**
 * Janela de tolerância do carimbo de tempo, em segundos (o padrão do Stripe).
 *
 * Sem ela, uma requisição legítima capturada por um intermediário poderia ser reenviada
 * meses depois com a assinatura ainda válida.
 */
export const STRIPE_TIMESTAMP_TOLERANCE_SECONDS = 300

export function isTimestampFresh(
  timestamp: number,
  nowSeconds: number,
  tolerance = STRIPE_TIMESTAMP_TOLERANCE_SECONDS
): boolean {
  return Math.abs(nowSeconds - timestamp) <= tolerance
}
