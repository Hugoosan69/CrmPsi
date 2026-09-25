"use client"

import { useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import type { TransactionView } from "@/services/financial.service"
import { TransactionsTable } from "./transactions-table"

type PaymentMethod = { id: string; name: string }

/**
 * O extrato de um paciente é a única lista do sistema que nunca pagina — a promessa da
 * ficha é mostrar TUDO. Mas "tudo" sem filtro vira uma rolagem infinita para quem atende o
 * mesmo paciente há anos. Filtro local, não na URL: o resultado já veio inteiro do
 * servidor, então recortar em memória é instantâneo e não pede um novo carregamento de
 * página para cada campo trocado.
 */
export function PatientTransactionsPanel({
  transactions,
  paymentMethods,
  canManage,
  canEditAmount = false,
  canEditPaid = false,
}: {
  transactions: TransactionView[]
  paymentMethods: PaymentMethod[]
  canManage: boolean
  canEditAmount?: boolean
  canEditPaid?: boolean
}) {
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [status, setStatus] = useState("")

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const data = t.due_date ?? t.created_at.slice(0, 10)
      if (dateFrom && data < dateFrom) return false
      if (dateTo && data > dateTo) return false
      if (status && t.status !== status) return false
      return true
    })
  }, [transactions, dateFrom, dateTo, status])

  const hasFilters = Boolean(dateFrom || dateTo || status)

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="pt-de">De</Label>
          <Input id="pt-de" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pt-ate">Até</Label>
          <Input id="pt-ate" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>
        <div className="grid gap-1.5">
          <Label>Situação</Label>
          <Select value={status} onValueChange={(v) => setStatus(v ?? "")}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
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

      {hasFilters && (
        <p className="text-[0.75rem] text-muted-foreground">
          {filtered.length} de {transactions.length} lançamento(s)
        </p>
      )}

      <TransactionsTable
        transactions={filtered}
        paymentMethods={paymentMethods}
        canManage={canManage}
        canEditAmount={canEditAmount}
        canEditPaid={canEditPaid}
      />
    </div>
  )
}
