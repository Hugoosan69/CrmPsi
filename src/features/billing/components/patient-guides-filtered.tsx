"use client"

import { useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { GuideRow } from "@/services/billing.service"
import { GuidesTable } from "./guides-table"

/**
 * Mesmo desenho de `PatientTransactionsPanel`: a lista de guias do paciente vem inteira do
 * servidor (é o que a ficha promete), e um paciente de convênio de longa data acumula guias
 * por anos — filtro local em cima do que já chegou, sem depender da URL.
 */
export function PatientGuidesFiltered({
  guides,
  canManage,
}: {
  guides: GuideRow[]
  canManage: boolean
}) {
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [status, setStatus] = useState("")

  const filtered = useMemo(() => {
    return guides.filter((g) => {
      const data = g.issuedAt.slice(0, 10)
      if (dateFrom && data < dateFrom) return false
      if (dateTo && data > dateTo) return false
      if (status && g.status !== status) return false
      return true
    })
  }, [guides, dateFrom, dateTo, status])

  const hasFilters = Boolean(dateFrom || dateTo || status)

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="pg-de">De</Label>
          <Input id="pg-de" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pg-ate">Até</Label>
          <Input id="pg-ate" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>
        <div className="grid gap-1.5">
          <Label>Situação</Label>
          <Select value={status} onValueChange={(v) => setStatus(v ?? "")}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              <SelectItem value="emitida">Emitida</SelectItem>
              <SelectItem value="enviada">Enviada</SelectItem>
              <SelectItem value="paga">Paga</SelectItem>
              <SelectItem value="glosada">Glosada</SelectItem>
              <SelectItem value="recusada">Recusada</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDateFrom("")
              setDateTo("")
              setStatus("")
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      <GuidesTable
        guides={filtered}
        showPatient={false}
        canManage={canManage}
        emptyTitle={
          guides.length === 0 ? "Nenhuma guia emitida para este paciente" : "Nenhuma guia neste recorte"
        }
        emptyDescription={
          guides.length === 0
            ? "As guias aparecem aqui quando o atendimento é registrado como convênio no momento do pagamento."
            : "Ajuste os filtros para ver as guias deste paciente."
        }
      />
    </div>
  )
}
