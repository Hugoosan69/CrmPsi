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
import { ACTION_LABELS, ENTITY_LABELS, humanizeSlug } from "./audit-labels"

export type AuditFilterValues = {
  de?: string
  ate?: string
  usuario?: string
  entidade?: string
  acao?: string
}

/**
 * Mesmo padrão de `FinancialFilters`: caixa com borda, rótulo em cima de cada controle,
 * estado só na URL — quem filtra é a consulta no servidor.
 */
export function AuditFilters({
  values,
  users,
  entityTypes,
  actions,
}: {
  values: AuditFilterValues
  users: { id: string; name: string }[]
  entityTypes: string[]
  actions: string[]
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
        <Label>Usuário</Label>
        <Select value={values.usuario ?? ""} onValueChange={(v) => set("usuario", v || null)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label>Entidade</Label>
        <Select value={values.entidade ?? ""} onValueChange={(v) => set("entidade", v || null)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas</SelectItem>
            {entityTypes.map((et) => (
              <SelectItem key={et} value={et}>
                {ENTITY_LABELS[et] ?? humanizeSlug(et)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label>Ação</Label>
        <Select value={values.acao ?? ""} onValueChange={(v) => set("acao", v || null)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>
                {ACTION_LABELS[a] ?? humanizeSlug(a)}
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
