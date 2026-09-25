"use client"

import { useEffect, useRef, useState } from "react"
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

export type ListFilterField =
  | { type: "search"; key: string; label: string; placeholder?: string }
  | {
      type: "select"
      key: string
      label: string
      placeholder?: string
      options: { value: string; label: string }[]
    }
  | { type: "date"; key: string; label: string }

/** Campo de busca com debounce — estado local próprio, por isso é seu próprio componente:
 *  um `useState` dentro do `.map()` do pai violaria as regras de hooks. */
function SearchField({
  field,
  onChangeDebounced,
}: {
  field: Extract<ListFilterField, { type: "search" }>
  onChangeDebounced: (key: string, value: string) => void
}) {
  const searchParams = useSearchParams()
  const [value, setValue] = useState(searchParams.get(field.key) ?? "")

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={`filter-${field.key}`}>{field.label}</Label>
      <Input
        id={`filter-${field.key}`}
        placeholder={field.placeholder}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          onChangeDebounced(field.key, e.target.value)
        }}
        className="w-56"
      />
    </div>
  )
}

/**
 * Barra de filtros genérica para listas simples (catálogo, cadastro): busca com debounce e
 * seletores, tudo na URL. Mesmo desenho de `FinancialFilters`/`AuditFilters`, mas configurável
 * por campos em vez de um componente por tela — a maioria dessas listas só precisa de
 * "buscar por nome" + um select de situação, e escrever isso de novo em cada módulo é o tipo
 * de duplicação que diverge no primeiro ajuste.
 */
export function ListFilters({ fields }: { fields: ListFilterField[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  function set(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams)
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete(PAGE_PARAM)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function setDebounced(key: string, value: string) {
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => set(key, value || null), 250)
  }

  const hasFilters = fields.some((f) => Boolean(searchParams.get(f.key)))

  return (
    <div className="flex flex-wrap items-end gap-3">
      {fields.map((field) => {
        if (field.type === "search") {
          return <SearchField key={field.key} field={field} onChangeDebounced={setDebounced} />
        }
        if (field.type === "date") {
          return (
            <div key={field.key} className="grid gap-1.5">
              <Label htmlFor={`filter-${field.key}`}>{field.label}</Label>
              <Input
                id={`filter-${field.key}`}
                type="date"
                defaultValue={searchParams.get(field.key) ?? ""}
                onChange={(e) => set(field.key, e.target.value || null)}
                className="w-40"
              />
            </div>
          )
        }
        return (
          <div key={field.key} className="grid gap-1.5">
            <Label>{field.label}</Label>
            <Select
              value={searchParams.get(field.key) ?? ""}
              onValueChange={(v) => set(field.key, v || null)}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder={field.placeholder ?? "Todos"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{field.placeholder ?? "Todos"}</SelectItem>
                {field.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )
      })}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.replace(pathname, { scroll: false })}>
          Limpar filtros
        </Button>
      )}
    </div>
  )
}
