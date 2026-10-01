"use client"

import { useCallback, useState } from "react"
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
  especialidade?: string
  origem?: string
  formaPagamento?: string
}

export function FinancialFilters({
  values,
  professionals,
  specialties,
  paymentMethods,
}: {
  values: FinancialFilterValues
  professionals: { id: string; full_name: string }[]
  specialties: { id: string; name: string }[]
  paymentMethods: { id: string; name: string }[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [local, setLocal] = useState<FinancialFilterValues>(values)

  const setField = useCallback((key: keyof FinancialFilterValues, value: string) => {
    setLocal((prev) => ({ ...prev, [key]: value || undefined }))
  }, [])

  function apply() {
    const params = new URLSearchParams(searchParams)
    const keys: (keyof FinancialFilterValues)[] = ["de", "ate", "profissional", "especialidade", "origem", "formaPagamento"]
    for (const key of keys) {
      if (local[key]) params.set(key, local[key]!)
      else params.delete(key)
    }
    params.delete(PAGE_PARAM)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function clear() {
    setLocal({})
    router.push(pathname, { scroll: false })
  }

  const hasFilters = Object.values(local).some(Boolean)

  return (
    <div className="grid gap-3 rounded-xl border border-border p-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="grid gap-1.5">
          <Label htmlFor="filter-de">De</Label>
          <Input
            id="filter-de"
            type="date"
            value={local.de ?? ""}
            onChange={(e) => setField("de", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="filter-ate">Até</Label>
          <Input
            id="filter-ate"
            type="date"
            value={local.ate ?? ""}
            onChange={(e) => setField("ate", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Profissional</Label>
          <Select value={local.profissional ?? ""} onValueChange={(v) => setField("profissional", v ?? "")}>
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
          <Label>Especialidade</Label>
          <Select value={local.especialidade ?? ""} onValueChange={(v) => setField("especialidade", v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              {specialties.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Tipo de cobrança</Label>
          <Select value={local.origem ?? ""} onValueChange={(v) => setField("origem", v ?? "")}>
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
          <Select value={local.formaPagamento ?? ""} onValueChange={(v) => setField("formaPagamento", v ?? "")}>
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
      </div>
      <div className="flex justify-end gap-2">
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clear}>
            Limpar filtros
          </Button>
        )}
        <Button size="sm" onClick={apply}>
          Buscar
        </Button>
      </div>
    </div>
  )
}
