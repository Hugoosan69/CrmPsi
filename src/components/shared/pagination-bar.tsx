"use client"

import { useId } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  PAGE_PARAM,
  PAGE_SIZE_PARAM,
  PAGE_SIZES,
  pageCount,
  pageItems,
  rangeLabel,
} from "@/config/pagination"

/**
 * Controles de paginação de uma lista.
 *
 * O estado vive na URL, não em `useState`. Assim a página aberta sobrevive a um recarregar,
 * pode ser mandada por link para um colega, e — o que mais importa aqui — é lida pelo Server
 * Component que faz a consulta. Guardar em estado do cliente obrigaria a buscar tudo e
 * fatiar no navegador, que é exatamente o que a paginação existe para evitar.
 *
 * Trocar a quantidade por página volta para a primeira. Manter a página seria enganoso: quem
 * está na 7 de 20 com 10 por página e passa para 100 por página não quer a sétima centena de
 * registros, quer ver mais de uma vez só.
 *
 * Aparece mesmo com uma página só. A contagem ("12 registros") é informação por si — e é o
 * que responde à dúvida de sempre, se a lista está inteira ou cortada. Os botões de navegar
 * é que somem quando não há para onde ir.
 */
export function PaginationBar({
  total,
  page,
  pageSize,
  /** Nome do que está sendo listado, para a contagem ler naturalmente. */
  label = "registros",
  className,
}: {
  total: number
  page: number
  pageSize: number
  label?: string
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // Único por instância: duas barras na mesma tela repetiriam o id, e o `for` do rótulo
  // passaria a apontar para o seletor errado.
  const seletorId = useId()

  const totalPaginas = pageCount(total, pageSize)
  const { from, to } = rangeLabel(total, page, pageSize)

  // A página pedida não existe: link antigo, ou registros apagados desde que a tela abriu.
  // A tabela acima está vazia por isso, e não porque a lista esteja vazia — dizer qual das
  // duas coisas é o ponto, senão alguém conclui que os dados sumiram.
  const foraDoIntervalo = total > 0 && page > totalPaginas

  function irPara(alteracoes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams)
    for (const [chave, valor] of Object.entries(alteracoes)) {
      if (valor === null) params.delete(chave)
      else params.set(chave, valor)
    }
    const query = params.toString()
    // `scroll: false` — trocar de página numa tabela longa não deve jogar a pessoa para o
    // topo do documento; ela está olhando a tabela.
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  function irParaPagina(destino: number) {
    // A primeira página não carrega parâmetro: mantém a URL limpa no caso mais comum.
    irPara({ [PAGE_PARAM]: destino <= 1 ? null : String(destino) })
  }

  if (foraDoIntervalo) {
    return (
      <div className={cn("flex flex-col gap-2 border-t border-border pt-3", className)}>
        <p className="text-[0.78rem] text-muted-foreground">
          A página {page} não existe — há {total} {label} em {totalPaginas}{" "}
          {totalPaginas === 1 ? "página" : "páginas"}.
        </p>
        <div>
          <Button variant="outline" size="sm" onClick={() => irParaPagina(totalPaginas)}>
            Ir para a última página
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <p className="text-[0.78rem] text-muted-foreground tabular-nums">
          {total === 0
            ? `Nenhum ${label.replace(/s$/, "")}`
            : `${from}–${to} de ${total} ${label}`}
        </p>

        <div className="flex items-center gap-1.5">
          <label
            htmlFor={seletorId}
            className="text-[0.78rem] whitespace-nowrap text-muted-foreground"
          >
            por página
          </label>
          <Select
            value={String(pageSize)}
            onValueChange={(valor) =>
              // Volta para a primeira página junto: ver a lista com outro tamanho é um
              // recomeço, não uma continuação.
              irPara({
                [PAGE_SIZE_PARAM]: valor ? String(valor) : null,
                [PAGE_PARAM]: null,
              })
            }
          >
            <SelectTrigger id={seletorId} size="sm" className="h-7 w-[4.5rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((tamanho) => (
                <SelectItem key={tamanho} value={String(tamanho)}>
                  {tamanho}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {totalPaginas > 1 && (
        <nav aria-label="Paginação" className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Página anterior"
            disabled={page <= 1}
            onClick={() => irParaPagina(page - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>

          {pageItems(page, totalPaginas).map((item, i) =>
            item === null ? (
              <span
                key={`reticencia-${i}`}
                className="px-1 text-[0.78rem] text-muted-foreground"
                aria-hidden
              >
                …
              </span>
            ) : (
              <Button
                key={item}
                variant={item === page ? "secondary" : "ghost"}
                size="icon-sm"
                className="tabular-nums"
                aria-label={`Página ${item}`}
                aria-current={item === page ? "page" : undefined}
                onClick={() => irParaPagina(item)}
              >
                {item}
              </Button>
            )
          )}

          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Próxima página"
            disabled={page >= totalPaginas}
            onClick={() => irParaPagina(page + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </nav>
      )}
    </div>
  )
}
