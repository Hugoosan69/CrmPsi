"use client"

import { useCallback, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Eye,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PAGE_PARAM } from "@/config/pagination"
import type { CashFlowRow } from "@/services/financial.service"
import type { TransactionView } from "@/services/financial.service"
import { listTransactionsForPeriodAction } from "../actions/cash-flow.actions"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatLabel(label: string, groupBy: "day" | "month") {
  if (groupBy === "day") {
    const [y, m, d] = label.split("-")
    const date = new Date(Number(y), Number(m) - 1, Number(d))
    const weekday = date.toLocaleDateString("pt-BR", { weekday: "short" })
    return `${weekday}, ${d}/${m}/${y}`
  }
  const [y, m] = label.split("-")
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ]
  return `${months[Number(m) - 1]} ${y}`
}

function formatShortLabel(label: string, groupBy: "day" | "month") {
  if (groupBy === "day") {
    const [y, m, d] = label.split("-")
    return `${d}/${m}/${y}`
  }
  const [y, m] = label.split("-")
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
  return `${months[Number(m) - 1]} ${y}`
}

function lastDayOfMonth(label: string) {
  const [y, m] = label.split("-").map(Number)
  return new Date(y, m, 0).getDate()
}

function isToday(label: string) {
  return label === new Date().toISOString().slice(0, 10)
}

function isCurrentMonth(label: string) {
  return label === new Date().toISOString().slice(0, 7)
}

function describeTransaction(t: TransactionView): string {
  if (t.packageLink) {
    const prefixo = t.packageLink.kind === "venda" ? "Venda de pacote" : "Sessão de pacote"
    return `${prefixo} — ${t.packageLink.packageName}`
  }
  if (t.procedureName) return `Atendimento — ${t.procedureName}`
  return t.description || t.category || "—"
}

// ---------------------------------------------------------------------------

export type ResumoType = "periodo" | "diario" | "mensal"

export function ResumoSelector({ value }: { value: ResumoType }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function onChange(v: string | null) {
    const params = new URLSearchParams(searchParams)
    if (!v || v === "periodo") params.delete("resumo")
    else params.set("resumo", v)
    params.delete(PAGE_PARAM)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="periodo">Resumo por período</SelectItem>
        <SelectItem value="diario">Resumo diário</SelectItem>
        <SelectItem value="mensal">Resumo mensal</SelectItem>
      </SelectContent>
    </Select>
  )
}

// ---------------------------------------------------------------------------

function DrillDownDialog({
  open,
  onClose,
  label,
  groupBy,
  dateFrom,
  dateTo,
}: {
  open: boolean
  onClose: () => void
  label: string
  groupBy: "day" | "month"
  dateFrom: string
  dateTo: string
}) {
  const [rows, setRows] = useState<TransactionView[] | null>(null)
  const [loading, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setRows(null)
    setError(null)
    startTransition(async () => {
      const result = await listTransactionsForPeriodAction(dateFrom, dateTo)
      if (result.error) setError(result.error)
      else setRows(result.rows ?? [])
    })
  }, [dateFrom, dateTo])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) load()
      else onClose()
    },
    [load, onClose]
  )

  const receitas = (rows ?? []).filter((r) => r.type === "receita")
  const despesas = (rows ?? []).filter((r) => r.type === "despesa")
  const totalReceitas = receitas.reduce((s, r) => s + Number(r.amount), 0)
  const totalDespesas = despesas.reduce((s, r) => s + Number(r.amount), 0)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="size-4" />
            {formatLabel(label, groupBy)}
          </DialogTitle>
          <DialogDescription>
            Lançamentos pagos {groupBy === "day" ? "neste dia" : "neste mês"}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="grid gap-3">
            <div className="flex gap-3">
              <Skeleton className="h-16 flex-1" />
              <Skeleton className="h-16 flex-1" />
            </div>
            <Skeleton className="h-40" />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {rows && !loading && (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/30">
                <ArrowUpRight className="size-5 text-emerald-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Receitas ({receitas.length})</p>
                  <p className="text-lg font-semibold text-emerald-600">{formatCurrency(totalReceitas)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-red-50 p-3 dark:bg-red-950/30">
                <ArrowDownRight className="size-5 text-red-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Despesas ({despesas.length})</p>
                  <p className="text-lg font-semibold text-red-600">{formatCurrency(totalDespesas)}</p>
                </div>
              </div>
            </div>

            {rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum lançamento pago neste período.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lançamento</TableHead>
                    <TableHead className="hidden sm:table-cell">Paciente</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <span className="flex flex-wrap items-center gap-1.5 font-medium">
                          {describeTransaction(t)}
                          {t.isPackage && (
                            <Badge variant="secondary" className="font-normal">Pacote</Badge>
                          )}
                        </span>
                        {t.patientName && (
                          <p className="text-xs text-muted-foreground sm:hidden">{t.patientName}</p>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {t.patientName || "—"}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <span className={t.type === "despesa" ? "text-red-600" : "text-emerald-600"}>
                          {t.type === "despesa" ? "− " : "+ "}
                          {formatCurrency(Number(t.amount))}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------

export function CashFlowTable({
  rows,
  groupBy,
}: {
  rows: CashFlowRow[]
  groupBy: "day" | "month"
}) {
  const [drillDown, setDrillDown] = useState<{
    label: string
    dateFrom: string
    dateTo: string
  } | null>(null)

  const totalReceitas = rows.reduce((s, r) => s + r.receitas, 0)
  const totalDespesas = rows.reduce((s, r) => s + r.despesas, 0)
  const totalSaldo = totalReceitas - totalDespesas

  function openDrillDown(label: string) {
    const dateFrom = groupBy === "day" ? label : `${label}-01`
    const dateTo =
      groupBy === "day"
        ? label
        : `${label}-${String(lastDayOfMonth(label)).padStart(2, "0")}`
    setDrillDown({ label, dateFrom, dateTo })
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Wallet className="mx-auto mb-3 size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Nenhum lançamento pago no período selecionado.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Ajuste os filtros de data acima para buscar outro período.
          </p>
        </CardContent>
      </Card>
    )
  }

  const maxReceita = Math.max(...rows.map((r) => r.receitas), 1)

  return (
    <>
      <div className="grid gap-4">
        {/* Summary cards */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="border-emerald-200 dark:border-emerald-900">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950">
                <TrendingUp className="size-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Total receitas</p>
                <p className="truncate text-xl font-semibold text-emerald-600">
                  {formatCurrency(totalReceitas)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-200 dark:border-red-900">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950">
                <TrendingDown className="size-5 text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Total despesas</p>
                <p className="truncate text-xl font-semibold text-red-600">
                  {formatCurrency(totalDespesas)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className={totalSaldo >= 0 ? "border-emerald-200 dark:border-emerald-900" : "border-red-200 dark:border-red-900"}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${totalSaldo >= 0 ? "bg-emerald-100 dark:bg-emerald-950" : "bg-red-100 dark:bg-red-950"}`}>
                <Wallet className={`size-5 ${totalSaldo >= 0 ? "text-emerald-600" : "text-red-600"}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Saldo no período</p>
                <p className={`truncate text-xl font-semibold ${totalSaldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatCurrency(totalSaldo)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarDays className="size-4" />
              {groupBy === "day" ? "Movimentação por dia" : "Movimentação por mês"}
              <Badge variant="outline" className="ml-auto font-normal">
                {rows.length} {groupBy === "day" ? (rows.length === 1 ? "dia" : "dias") : (rows.length === 1 ? "mês" : "meses")}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-3">
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {groupBy === "day" ? "Data" : "Mês"}
                    </th>
                    <th className="hidden px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground sm:table-cell">
                      Receitas
                    </th>
                    <th className="hidden px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground sm:table-cell">
                      Despesas
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Saldo
                    </th>
                    <th className="w-10 px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const highlight =
                      (groupBy === "day" && isToday(row.label)) ||
                      (groupBy === "month" && isCurrentMonth(row.label))
                    const barWidth = Math.round((row.receitas / maxReceita) * 100)

                    return (
                      <tr
                        key={row.label}
                        className={`group border-b border-border transition-colors last:border-0 ${
                          highlight
                            ? "bg-primary/5"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {formatShortLabel(row.label, groupBy)}
                            </span>
                            {highlight && (
                              <Badge variant="default" className="text-[10px] px-1.5 py-0">
                                {groupBy === "day" ? "Hoje" : "Atual"}
                              </Badge>
                            )}
                          </div>
                          {/* Mini bar on mobile */}
                          <div className="mt-1 flex items-center gap-2 sm:hidden">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {row.count}
                            </span>
                          </div>
                          {/* Receitas/Despesas on mobile */}
                          <div className="mt-1 flex gap-3 text-xs sm:hidden">
                            <span className="text-emerald-600">+{formatCurrency(row.receitas)}</span>
                            {row.despesas > 0 && (
                              <span className="text-red-600">−{formatCurrency(row.despesas)}</span>
                            )}
                          </div>
                        </td>
                        <td className="hidden px-4 py-2.5 text-right sm:table-cell">
                          <div className="flex items-center justify-end gap-2">
                            <div className="hidden w-20 overflow-hidden rounded-full bg-muted lg:block">
                              <div
                                className="h-1.5 rounded-full bg-emerald-500"
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                            <span className="tabular-nums text-emerald-600">
                              {formatCurrency(row.receitas)}
                            </span>
                          </div>
                        </td>
                        <td className="hidden px-4 py-2.5 text-right tabular-nums sm:table-cell">
                          {row.despesas > 0 ? (
                            <span className="text-red-600">{formatCurrency(row.despesas)}</span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className={`tabular-nums font-medium ${
                              row.saldo >= 0 ? "text-emerald-600" : "text-red-600"
                            }`}
                          >
                            {formatCurrency(row.saldo)}
                          </span>
                        </td>
                        <td className="px-2 py-2.5">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={() => openDrillDown(row.label)}
                            title="Ver lançamentos"
                          >
                            <Eye className="size-4" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 z-10 bg-card">
                  <tr className="border-t-2 border-border">
                    <td className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">
                      Total
                    </td>
                    <td className="hidden px-4 py-2.5 text-right font-semibold tabular-nums text-emerald-600 sm:table-cell">
                      {formatCurrency(totalReceitas)}
                    </td>
                    <td className="hidden px-4 py-2.5 text-right font-semibold tabular-nums text-red-600 sm:table-cell">
                      {formatCurrency(totalDespesas)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${totalSaldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {formatCurrency(totalSaldo)}
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {rows.reduce((s, r) => s + r.count, 0)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {drillDown && (
        <DrillDownDialog
          open
          onClose={() => setDrillDown(null)}
          label={drillDown.label}
          groupBy={groupBy}
          dateFrom={drillDown.dateFrom}
          dateTo={drillDown.dateTo}
        />
      )}
    </>
  )
}
