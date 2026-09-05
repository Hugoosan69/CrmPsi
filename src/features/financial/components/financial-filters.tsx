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
import { PAGE_PARAM } from "@/config/pagination"

export type FinancialFilterValues = {
  de?: string
  ate?: string
  profissional?: string
  origem?: string
  formaPagamento?: string
}

/**
 * Filtros gerenciais combináveis (requisito 7) — todos controlados pela URL, no mesmo
 * padrão de `FinancialTabs`: quem filtra é a consulta no servidor, esta barra só empurra
 * os parâmetros.
 */
export function FinancialFilters({
  values,
  professionals,
  paymentMethods,
}: {
  values: FinancialFilterValues
  professionals: { id: string; full_name: string }[]
  paymentMethods: { id: string; name: string }[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function set(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams)
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete(PAGE_PARAM)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const hasFilters = Object.values(values).some(Boolean)

  return (
    <div className="grid grid-cols-2 gap-3 rounded-xl border border-border p-3 sm:grid-cols-3 lg:grid-cols-5">
      <div className="grid gap-1.5">
        <Label htmlFor="filter-de">De</Label>
        <Input
          id="filter-de"
          type="date"
          defaultValue={values.de ?? ""}
          onChange={(e) => set("de", e.target.value || null)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="filter-ate">Até</Label>
        <Input
          id="filter-ate"
          type="date"
          defaultValue={values.ate ?? ""}
          onChange={(e) => set("ate", e.target.value || null)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label>Profissional</Label>
        <Select value={values.profissional ?? ""} onValueChange={(v) => set("profissional", v || null)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            {professionals.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label>Tipo de cobrança</Label>
        <Select value={values.origem ?? ""} onValueChange={(v) => set("origem", v || null)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            <SelectItem value="avulsa">Avulsa</SelectItem>
            <SelectItem value="pacote">Pacote</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label>Forma de pagamento</Label>
        <Select
          value={values.formaPagamento ?? ""}
          onValueChange={(v) => set("formaPagamento", v || null)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas</SelectItem>
            {paymentMethods.map((pm) => (
              <SelectItem key={pm.id} value={pm.id}>
                {pm.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {hasFilters && (
        <div className="col-span-full flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
            Limpar filtros
          </Button>
        </div>
      )}
    </div>
  )
}
