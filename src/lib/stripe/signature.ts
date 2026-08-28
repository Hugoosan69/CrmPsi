import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

import {
  isTimestampFresh,
  parseStripeSignature,
  signedPayload,
} from "@/config/stripe"

/**
 * Confere o cabeçalho `Stripe-Signature` de um webhook.
 *
 * Escrito à mão em vez de usar `stripe.webhooks.constructEvent`. O SDK oficial traz uma
 * árvore de dependências inteira para, aqui, um HMAC-SHA256 de vinte linhas — e o endpoint
 * precisa existir antes de qualquer decisão sobre adotar o SDK no resto da integração.
 *
 * Sem esta conferência o endereço do webhook é público e sem autenticação: qualquer um que
 * o descubra pode postar `payment_intent.succeeded` e quitar uma cobrança sem pagar.
 */
export function verifyStripeSignature({
  rawBody,
  header,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  rawBody: string
  header: string | null
  secret: string
  nowSeconds?: number
}): { ok: true } | { ok: false; reason: string } {
  const parsed = parseStripeSignature(header)
  if (!parsed) return { ok: false, reason: "assinatura ausente ou malformada" }

  if (!isTimestampFresh(parsed.timestamp, nowSeconds)) {
    return { ok: false, reason: "carimbo de tempo fora da janela de tolerância" }
  }

  const expected = createHmac("sha256", secret)
    .update(signedPayload(parsed.timestamp, rawBody))
    .digest("hex")

  // Comparação em tempo constante: um `===` vaza, pela duração, quantos caracteres iniciais
  // acertaram, e isso basta para adivinhar a assinatura byte a byte.
  const expectedBuffer = Buffer.from(expected, "utf8")
  const matched = parsed.signatures.some((candidate) => {
    const candidateBuffer = Buffer.from(candidate, "utf8")
    // timingSafeEqual lança se os tamanhos diferem — o que já é diferença suficiente.
    if (candidateBuffer.length !== expectedBuffer.length) return false
    return timingSafeEqual(candidateBuffer, expectedBuffer)
  })

  if (!matched) return { ok: false, reason: "assinatura não confere" }
  return { ok: true }
}
