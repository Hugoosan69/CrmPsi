"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type GuideFilterValues = {
  /** "YYYY-MM" — o input nativo de mês devolve nesse formato. */
  mes?: string
  convenio?: string
  situacao?: string
}

const TODOS = "__todos__"

const SITUACOES = [
  { value: "emitida", label: "Emitida" },
  { value: "enviada", label: "Enviada" },
  { value: "paga", label: "Paga" },
  { value: "glosada", label: "Glosada" },
  { value: "recusada", label: "Recusada" },
]

/**
 * Filtros da listagem de guias, na URL como o resto do sistema.
 *
 * Mês em primeiro lugar porque o recorte mensal é o que a rotina exige: as guias do mês são
 * o que vira protocolo e vai para o convênio. A aba abre no mês corrente, e mudar o mês é
 * o gesto para conferir o que já foi enviado.
 */
export function GuidesFilters({
  values,
  insurers,
}: {
  values: GuideFilterValues
  insurers: { id: string; name: string }[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function aplicar(chave: string, valor: string | undefined) {
    const params = new URLSearchParams(searchParams.toString())
    if (!valor || valor === TODOS) params.delete(chave)
    else params.set(chave, valor)
    // A aba selecionada vive na URL junto com os filtros; preservá-la evita voltar para
    // "Pacotes" a cada mudança de mês.
    params.set("aba", "guias")
    router.push(`${pathname}?${params.toString()}`)
  }

  const temFiltro = Boolean(values.mes || values.convenio || values.situacao)

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="guia-mes">Mês</Label>
        <Input
          id="guia-mes"
          type="month"
          className="w-44"
          value={values.mes ?? ""}
          onChange={(e) => aplicar("mes", e.target.value)}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="guia-convenio">Convênio</Label>
        <Select
          value={values.convenio ?? TODOS}
          onValueChange={(v) => aplicar("convenio", v ?? undefined)}
        >
          <SelectTrigger id="guia-convenio" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos</SelectItem>
            {insurers.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="guia-situacao">Situação</Label>
        <Select
          value={values.situacao ?? TODOS}
          onValueChange={(v) => aplicar("situacao", v ?? undefined)}
        >
          <SelectTrigger id="guia-situacao" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas</SelectItem>
            {SITUACOES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {temFiltro && (
        <Button variant="ghost" size="sm" onClick={() => router.push(`${pathname}?aba=guias`)}>
          Limpar
        </Button>
      )}
    </div>
  )
}
