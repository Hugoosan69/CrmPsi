"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export type UrlTab = { value: string; label: string }

/**
 * Abas cuja seleção vive em `?aba=`.
 *
 * `defaultValue` do Tabs não serve quando a própria aba tem filtros: qualquer navegação —
 * mudar o mês, trocar o convênio — remonta a página e a aba volta para a primeira, jogando
 * quem estava filtrando de volta ao começo. Com a aba na URL ela sobrevive à navegação, ao
 * recarregar e ao link compartilhado.
 *
 * `ProfessionalsTabs` faz o mesmo e continua separado de propósito: lá a troca de aba
 * também zera a paginação, porque as quatro listas dividem o mesmo par de parâmetros.
 * Generalizar as duas exigiria um parâmetro que só uma usa.
 */
export function UrlTabs({
  active,
  tabs,
  children,
}: {
  active: string
  tabs: UrlTab[]
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function trocar(aba: string | null) {
    if (!aba) return
    const params = new URLSearchParams(searchParams)
    params.set("aba", aba)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <Tabs value={active} onValueChange={trocar} className="grid gap-4">
      <TabsList>
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  )
}
