/**
 * Endereço canônico da aplicação.
 *
 * Módulo neutro: o proxy usa para redirecionar, e a recuperação de senha usa para dizer ao
 * Supabase para onde voltar. Precisam concordar — se divergirem, o link do e-mail leva a um
 * host diferente daquele onde a sessão foi iniciada.
 *
 * Por que isso importa mais do que parece: o fluxo PKCE grava o `code_verifier` num COOKIE,
 * preso ao domínio onde o pedido foi feito. Se o e-mail leva para outro host — a URL da
 * Vercel em vez do domínio próprio — o cookie não acompanha, `exchangeCodeForSession` não
 * acha o verificador, e a tela mostra "Link inválido ou expirado" para um link
 * perfeitamente válido. Observado em produção.
 *
 * NEXT_PUBLIC_SITE_URL sobrescreve, para preview e para quem hospedar noutro endereço. O
 * padrão é o domínio de produção porque um valor esquecido no painel não pode quebrar a
 * recuperação de senha — foi exatamente o que aconteceu.
 */
const DEFAULT_CANONICAL = "https://csibrasilia.club"

function normalize(url: string) {
  return url.trim().replace(/\/+$/, "")
}

export const CANONICAL_ORIGIN = normalize(
  process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_CANONICAL
)

/** Só o host, para comparar com o cabeçalho da requisição. */
export const CANONICAL_HOST = (() => {
  try {
    return new URL(CANONICAL_ORIGIN).host
  } catch {
    return ""
  }
})()

/**
 * O host da requisição deve ser redirecionado para o canônico?
 *
 * Endereços de desenvolvimento e preview ficam de fora: redirecionar `localhost` para
 * produção tornaria impossível trabalhar, e forçar um preview da Vercel para produção
 * anularia o propósito de ter previews.
 */
export function shouldRedirectToCanonical(host: string | null): boolean {
  if (!host || !CANONICAL_HOST) return false
  if (host === CANONICAL_HOST) return false

  const bare = host.split(":")[0]
  if (bare === "localhost" || bare === "127.0.0.1" || bare.endsWith(".local")) return false
  // Previews da Vercel têm hash no subdomínio (crm-abc123-projeto.vercel.app). O deploy de
  // produção antigo não tem, e é justamente esse que precisa redirecionar.
  if (/^[a-z0-9-]+-[a-z0-9]{9}-/.test(bare)) return false

  return true
}
