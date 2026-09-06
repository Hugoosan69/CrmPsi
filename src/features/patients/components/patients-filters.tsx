"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
  pacote?: string
  contato?: string
  ordem?: string
}

/**
 * Filtros da tela de Pacientes, todos na URL — mesmo padrão de `FinancialFilters`: quem
 * filtra é a consulta no servidor, esta barra só empurra os parâmetros.
 *
 * Não há filtro por especialidade: paciente não pertence a uma especialidade neste modelo
 * (o vínculo é do procedimento do atendimento), então o filtro daria a impressão de recortar
 * um cadastro que na verdade não tem esse campo.
 */
export function PatientsFilters({ values }: { values: PatientsFilterValues }) {
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
    <div className="grid grid-cols-2 gap-3 rounded-xl border border-border p-3 sm:grid-cols-4">
      <div className="grid gap-1.5">
        <Label>Situação</Label>
        <Select value={values.status ?? ""} onValueChange={(v) => set("status", v || null)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Ativos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Ativos</SelectItem>
            <SelectItem value="inativos">Inativos</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label>Pacote</Label>
        <Select value={values.pacote ?? ""} onValueChange={(v) => set("pacote", v || null)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            <SelectItem value="com">Com saldo em aberto</SelectItem>
            <SelectItem value="sem">Sem pacote ativo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label>Contato</Label>
        <Select value={values.contato ?? ""} onValueChange={(v) => set("contato", v || null)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            <SelectItem value="sem">Sem telefone e WhatsApp</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label>Ordenar por</Label>
        <Select value={values.ordem ?? ""} onValueChange={(v) => set("ordem", v || null)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Nome" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Nome</SelectItem>
            <SelectItem value="recentes">Cadastro mais recente</SelectItem>
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
