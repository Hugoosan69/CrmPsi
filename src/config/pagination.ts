/**
 * Paginação — peças puras, sem servidor nem React.
 *
 * Ficam num módulo neutro porque os dois lados precisam concordar: a página lê `pagina` e
 * `por` da URL para consultar o banco, e a barra de controles lê os mesmos parâmetros para
 * desenhar os botões. Um "clamp" diferente de cada lado produziria a pior falha possível —
 * a barra dizendo "página 7 de 3" enquanto a consulta devolve vazio.
 */

/** Quantidades oferecidas no seletor. */
export const PAGE_SIZES = [10, 25, 50, 100] as const

export const DEFAULT_PAGE_SIZE = 25

/** Nomes dos parâmetros na URL, em português como o resto do sistema (`busca`, `aba`). */
export const PAGE_PARAM = "pagina"
export const PAGE_SIZE_PARAM = "por"

export type Pagination = {
  /** 1-based, como aparece para quem usa. */
  page: number
  pageSize: number
  /** Deslocamento 0-based para o banco. */
  offset: number
  /** Último índice 0-based do intervalo — o que `range()` do PostgREST espera. */
  rangeEnd: number
}

/**
 * Lê a paginação da URL, corrigindo qualquer entrada inválida em vez de confiar nela.
 *
 * Estes valores vêm da barra de endereços e podem ser editados à mão: `?por=100000` viraria
 * uma varredura da tabela inteira, e `?pagina=-1` um deslocamento negativo que o PostgREST
 * recusa com erro. Aceitar só o que está na lista e ancorar o mínimo em 1 fecha as duas
 * portas sem precisar de mensagem de erro para algo que ninguém digita por engano.
 */
export function parsePagination(params: {
  page?: string | number | null
  pageSize?: string | number | null
}): Pagination {
  const pageSizeBruto = Number(params.pageSize)
  const pageSize = (PAGE_SIZES as readonly number[]).includes(pageSizeBruto)
    ? pageSizeBruto
    : DEFAULT_PAGE_SIZE

  const pageBruto = Math.floor(Number(params.page))
  const page = Number.isFinite(pageBruto) && pageBruto > 0 ? pageBruto : 1

  const offset = (page - 1) * pageSize
  return { page, pageSize, offset, rangeEnd: offset + pageSize - 1 }
}

/** Total de páginas. Zero registro continua sendo uma página — a que diz "nada aqui". */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

/**
 * Faixa exibida ("11–20 de 137"), 1-based e já limitada pelo total.
 *
 * O fim é limitado ao total porque a última página quase nunca está cheia: sem isso,
 * a tela anunciaria "121–140 de 137".
 */
export function rangeLabel(total: number, page: number, pageSize: number) {
  if (total === 0) return { from: 0, to: 0 }
  const from = (page - 1) * pageSize + 1
  return { from, to: Math.min(page * pageSize, total) }
}

/**
 * Os números a desenhar, com reticências quando não cabem todos.
 *
 * Primeira e última sempre presentes: são os dois saltos que alguém realmente quer dar numa
 * lista longa. `null` representa a reticência.
 */
export function pageItems(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const vizinhos = 1
  const inicio = Math.max(2, current - vizinhos)
  const fim = Math.min(total - 1, current + vizinhos)

  const itens: (number | null)[] = [1]
  if (inicio > 2) itens.push(null)
  for (let p = inicio; p <= fim; p++) itens.push(p)
  if (fim < total - 1) itens.push(null)
  itens.push(total)
  return itens
}
