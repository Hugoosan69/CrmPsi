"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { CashFlowRow } from "@/services/financial.service"
import { PAGE_PARAM } from "@/config/pagination"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatLabel(label: string, groupBy: "day" | "month") {
  if (groupBy === "day") {
    const [y, m, d] = label.split("-")
    return `${d}/${m}/${y}`
  }
  const [y, m] = label.split("-")
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ]
  return `${months[Number(m) - 1]} ${y}`
}

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
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">Resumo:</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="periodo">Por período</SelectItem>
          <SelectItem value="diario">Diário</SelectItem>
          <SelectItem value="mensal">Mensal</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

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
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nenhum lançamento pago no período selecionado.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total receitas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-emerald-600">
            {formatCurrency(totalReceitas)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total despesas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-red-600">
            {formatCurrency(totalDespesas)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo</CardTitle>
          </CardHeader>
          <CardContent className={`text-2xl font-semibold ${totalSaldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {formatCurrency(totalSaldo)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {groupBy === "day" ? "Data" : "Mês"}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Receitas</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Despesas</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Saldo</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Lançamentos</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-medium">{formatLabel(row.label, groupBy)}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-600">{formatCurrency(row.receitas)}</td>
                    <td className="px-4 py-2.5 text-right text-red-600">{formatCurrency(row.despesas)}</td>
                    <td className={`px-4 py-2.5 text-right font-medium ${row.saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {formatCurrency(row.saldo)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{row.count}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/50">
                  <td className="px-4 py-2.5 font-semibold">Total</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">{formatCurrency(totalReceitas)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-red-600">{formatCurrency(totalDespesas)}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${totalSaldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(totalSaldo)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-muted-foreground">
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
