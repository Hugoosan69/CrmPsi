"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  CalendarDays,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PAGE_PARAM } from "@/config/pagination"
import type { CashFlowRow } from "@/services/financial.service"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
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

function isToday(label: string) {
  return label === new Date().toISOString().slice(0, 10)
}

function isCurrentMonth(label: string) {
  return label === new Date().toISOString().slice(0, 7)
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

export function CashFlowTable({
  rows,
  groupBy,
}: {
  rows: CashFlowRow[]
  groupBy: "day" | "month"
}) {
  const totalReceitas = rows.reduce((s, r) => s + r.receitas, 0)
  const totalDespesas = rows.reduce((s, r) => s + r.despesas, 0)
  const totalSaldo = totalReceitas - totalDespesas

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
                    <th className="hidden w-16 px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground sm:table-cell">Qtd</th>
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
                        <td className="hidden px-4 py-2.5 text-right tabular-nums text-muted-foreground sm:table-cell">
                          {row.count}
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
                    <td className="hidden px-4 py-2.5 text-right tabular-nums text-muted-foreground sm:table-cell">
                      {rows.reduce((s, r) => s + r.count, 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
    </div>
  )
}
