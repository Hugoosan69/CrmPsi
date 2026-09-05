"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PAGE_PARAM } from "@/config/pagination"

/**
 * Filtro de período de "Meu financeiro". Enxuto de propósito: os demais filtros da tela de
 * gestão (profissional, tipo de cobrança, forma de pagamento) ou não fazem sentido aqui —
 * o profissional é sempre o mesmo — ou pertencem à conferência de caixa, que não é o que
 * esta tela responde.
 */
export function OwnFinancialFilters({ values }: { values: { de?: string; ate?: string } }) {
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

  const hasFilters = Boolean(values.de || values.ate)

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border p-3">
      <div className="grid gap-1.5">
        <Label htmlFor="own-de">De</Label>
        <Input
          id="own-de"
          type="date"
          defaultValue={values.de ?? ""}
          onChange={(e) => set("de", e.target.value || null)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="own-ate">Até</Label>
        <Input
          id="own-ate"
          type="date"
          defaultValue={values.ate ?? ""}
          onChange={(e) => set("ate", e.target.value || null)}
        />
      </div>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          Limpar
        </Button>
      )}
    </div>
  )
}
