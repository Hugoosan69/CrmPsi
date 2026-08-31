"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PAGE_PARAM } from "@/config/pagination"

const ROTULOS: Record<string, string> = {
  equipe: "Equipe",
  especialidades: "Especialidades",
  horarios: "Horários",
  salas: "Salas",
  bloqueios: "Bloqueios",
}

/**
 * As abas da tela de profissionais, controladas pela URL.
 *
 * Antes eram `defaultValue`, e a aba escolhida se perdia num recarregar. Agora ela vive em
 * `?aba=`, o que também dá endereço a cada seção — o redirecionamento de /gestao/agenda cai
 * direto em horários — e permite ao servidor saber qual lista precisa ser paginada.
 *
 * Trocar de aba zera a paginação: a página 3 da equipe não corresponde a nada em salas, e as
 * quatro listas compartilham o mesmo par de parâmetros justamente porque só uma está visível
 * por vez.
 */
export function ProfessionalsTabs({
  active,
  abas,
  children,
}: {
  active: string
  abas: readonly string[]
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function trocar(aba: string | null) {
    if (!aba) return
    const params = new URLSearchParams(searchParams)
    params.set("aba", aba)
    params.delete(PAGE_PARAM)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <Tabs value={active} onValueChange={trocar}>
      <TabsList>
        {abas.map((aba) => (
          <TabsTrigger key={aba} value={aba}>
            {ROTULOS[aba] ?? aba}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  )
}
