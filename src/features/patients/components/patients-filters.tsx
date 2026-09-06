"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PAGE_PARAM } from "@/config/pagination"

export type PatientsFilterValues = {
  status?: string
  especialidade?: string
}

export function PatientsFilters({
  values,
  specialties,
}: {
  values: PatientsFilterValues
  specialties: { id: string; name: string }[]
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
    <div className="grid grid-cols-2 gap-3 rounded-xl border border-border p-3 sm:grid-cols-3 lg:grid-cols-4">
      <div className="grid gap-1.5">
        <label className="text-sm font-medium">Status</label>
        <Select value={values.status ?? ""} onValueChange={(v) => set("status", v || null)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <label className="text-sm font-medium">Especialidade</label>
        <Select
          value={values.especialidade ?? ""}
          onValueChange={(v) => set("especialidade", v || null)}
        >
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
