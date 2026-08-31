"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PAGE_PARAM } from "@/config/pagination"

export type FinancialTab = "pendentes" | "receitas" | "despesas"

/**
 * As abas do financeiro, controladas pela URL.
 *
 * Antes a página trazia todos os lançamentos e cada aba filtrava no navegador. Isso não
 * sobrevive à paginação: paginar o conjunto inteiro e depois filtrar daria abas de tamanhos
 * imprevisíveis — a página 2 poderia não ter nenhuma despesa, e a barra continuaria dizendo
 * que há mais. Agora quem filtra é a consulta, e cada aba tem a sua própria contagem e as
 * suas próprias páginas.
 *
 * O conteúdo não está aqui: vem do Server Component, já filtrado. Este componente é só a
 * régua de abas, que precisa ser cliente para empurrar a troca para a URL.
 */
export function FinancialTabs({
  active,
  pendentesCount,
}: {
  active: FinancialTab
  pendentesCount: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function trocar(aba: string | null) {
    if (!aba) return
    const params = new URLSearchParams(searchParams)
    params.set("aba", aba)
    // Trocar de aba recomeça a paginação: a página 4 de receitas não corresponde a nada em
    // despesas.
    params.delete(PAGE_PARAM)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <Tabs value={active} onValueChange={trocar}>
      <TabsList>
        <TabsTrigger value="pendentes">Contas pendentes ({pendentesCount})</TabsTrigger>
        <TabsTrigger value="receitas">Receitas</TabsTrigger>
        <TabsTrigger value="despesas">Despesas</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
