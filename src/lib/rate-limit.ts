import "server-only"

/**
 * Limitador de taxa em memória, por janela deslizante simples.
 *
 * **Escopo honesto:** o contador vive no processo. Com mais de uma instância do app, cada
 * uma tem o seu, e o teto efetivo é `limite × instâncias`. Isso é aceitável para o que ele
 * protege aqui — adivinhação de token de convite e enxurrada de emissão de token — porque
 * o objetivo é tirar o ataque da faixa do viável (milhões de tentativas por minuto), não
 * cravar uma cota exata. Um teto real, compartilhado, exigiria Redis ou uma tabela, e
 * nenhum dos dois existe neste projeto hoje.
 *
 * Não usar isto para cota de cobrança ou qualquer coisa em que o número precise estar
 * certo.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/** Evita crescimento sem fim quando muitas chaves distintas passam por aqui. */
const MAX_KEYS = 10_000

function sweep(now: number) {
  if (buckets.size < MAX_KEYS) return
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  /** Segundos até a janela reabrir — vai no cabeçalho `Retry-After`. */
  retryAfterSeconds: number
}

export function rateLimit(
  key: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number }
): RateLimitResult {
  const now = Date.now()
  sweep(now)

  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 })
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 }
  }

  existing.count += 1
  const allowed = existing.count <= limit
  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: allowed ? 0 : Math.ceil((existing.resetAt - now) / 1000),
  }
}

/**
 * Endereço de origem da requisição, para servir de chave.
 *
 * Atrás de proxy (é o caso em produção) o socket é o do proxy, então vale `x-forwarded-for`.
 * O cabeçalho é falsificável por quem fala direto com a aplicação — mais uma razão para
 * este limitador ser uma barreira de custo, não um controle de acesso.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]!.trim()
  return request.headers.get("x-real-ip") ?? "desconhecido"
}
