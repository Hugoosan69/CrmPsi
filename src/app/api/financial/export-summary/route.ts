import { NextResponse, type NextRequest } from "next/server"

import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { getCashFlowSummary } from "@/services/financial.service"

export const dynamic = "force-dynamic"

function csvEscape(value: string) {
  if (/[";\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
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

export async function GET(request: NextRequest) {
  const membership = await requirePermission(PERMISSIONS.FINANCIAL_VIEW)
  const supabase = await createClient()

  const params = request.nextUrl.searchParams
  const groupBy = params.get("agrupamento") === "mensal" ? "month" : "day"
  const opts = {
    dateFrom: params.get("de") ?? undefined,
    dateTo: params.get("ate") ?? undefined,
  }

  const rows = await getCashFlowSummary(supabase, membership.clinicId, groupBy, opts)

  const header = [groupBy === "day" ? "Data" : "Mês", "Receitas", "Despesas", "Saldo", "Lançamentos"]
  const lines = [header.join(";")]
  for (const r of rows) {
    lines.push(
      [
        formatLabel(r.label, groupBy),
        r.receitas.toFixed(2).replace(".", ","),
        r.despesas.toFixed(2).replace(".", ","),
        r.saldo.toFixed(2).replace(".", ","),
        String(r.count),
      ]
        .map((v) => csvEscape(v))
        .join(";")
    )
  }

  const totalReceitas = rows.reduce((s, r) => s + r.receitas, 0)
  const totalDespesas = rows.reduce((s, r) => s + r.despesas, 0)
  lines.push(
    ["Total", totalReceitas.toFixed(2).replace(".", ","), totalDespesas.toFixed(2).replace(".", ","), (totalReceitas - totalDespesas).toFixed(2).replace(".", ","), String(rows.reduce((s, r) => s + r.count, 0))]
      .map((v) => csvEscape(v))
      .join(";")
  )

  const filename = groupBy === "day" ? "resumo-diario.csv" : "resumo-mensal.csv"

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
