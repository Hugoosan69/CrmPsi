import "server-only"

import { isRangeOverflow } from "@/lib/db-errors"

/**
 * Executa uma consulta paginada e devolve `{ rows, total }`.
 *
 * Existe por dois motivos que apareceram na prática.
 *
 * O primeiro é o construtor do supabase-js MUTAR a si mesmo: `query.range(...)` não devolve
 * uma cópia, devolve o mesmo objeto já alterado. Guardar "a consulta sem faixa" numa variável
 * antes de chamar `.range()` não guarda nada — as duas referências apontam para a consulta
 * com faixa. Por isso o que se passa aqui é uma FUNÇÃO que monta a consulta do zero, e não
 * uma consulta pronta.
 *
 * O segundo é o PostgREST responder 416 quando o deslocamento passa do fim. Isso acontece sem
 * ninguém adulterar a URL: basta estar na última página e alguém apagar o registro que a
 * sustentava. Nesse caso a lista voltava quebrada. Aqui o erro vira uma página vazia com o
 * total verdadeiro — `.limit(0)` traz a contagem sem trazer linha nenhuma — e a tela mostra
 * que aquela página deixou de existir em vez de um erro.
 */
export async function fetchPage<Row>(
  build: () => PromiseLike<{
    data: Row[] | null
    error: unknown
    count: number | null
  }> & {
    range: (from: number, to: number) => PromiseLike<{
      data: Row[] | null
      error: unknown
      count: number | null
    }>
    limit: (n: number) => PromiseLike<{
      data: Row[] | null
      error: unknown
      count: number | null
    }>
  },
  opts: { offset?: number; rangeEnd?: number } = {}
): Promise<{ rows: Row[]; total: number }> {
  const recortar = opts.offset !== undefined || opts.rangeEnd !== undefined

  const { data, error, count } = recortar
    ? await build().range(opts.offset ?? 0, opts.rangeEnd ?? Number.MAX_SAFE_INTEGER)
    : await build()

  if (!error) return { rows: data ?? [], total: count ?? 0 }
  if (!isRangeOverflow(error)) throw error

  const { count: total } = await build().limit(0)
  return { rows: [], total: total ?? 0 }
}
