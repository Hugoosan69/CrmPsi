import { NextResponse, type NextRequest } from "next/server"

import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { listTransactions } from "@/services/financial.service"
import type { FinancialTransactionStatus, FinancialTransactionType } from "@/types/supabase"

export const dynamic = "force-dynamic"

/**
 * Exportação CSV (requisito 7) — Route Handler porque é uma resposta de arquivo, não uma
 * mutação (docs/ARCHITECTURE.md §7: "api/ apenas onde Server Actions não servem"). Usa os
 * mesmos filtros da tela, lidos da própria querystring, e busca todas as páginas (até um
 * teto de segurança) em vez de só a página aberta — um relatório que só exportasse a
 * página visível sairia incompleto sem nada indicar.
 */
function csvEscape(value: string) {
  if (/[";\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export async function GET(request: NextRequest) {
  const membership = await requirePermission(PERMISSIONS.FINANCIAL_VIEW)
  const supabase = await createClient()

  const params = request.nextUrl.searchParams
  const opts = {
    type: (params.get("tipo") as FinancialTransactionType | null) ?? undefined,
    status: (params.get("status") as FinancialTransactionStatus | null) ?? undefined,
    professionalId: params.get("profissional") ?? undefined,
    sourceType: (params.get("origem") as "avulsa" | "pacote" | null) ?? undefined,
    paymentMethodId: params.get("formaPagamento") ?? undefined,
    dateFrom: params.get("de") ?? undefined,
    dateTo: params.get("ate") ?? undefined,
    rangeEnd: 4999,
  }

  const { rows } = await listTransactions(supabase, membership.clinicId, opts)

  const header = ["Data", "Descrição", "Categoria", "Paciente", "Tipo", "Valor", "Status"]
  const lines = [header.join(";")]
  for (const t of rows) {
    lines.push(
      [
        new Date(t.created_at).toLocaleDateString("pt-BR"),
        t.description ?? "",
        t.category ?? "",
        t.patientName ?? "",
        t.type,
        Number(t.amount).toFixed(2).replace(".", ","),
        t.status,
      ]
        .map((v) => csvEscape(String(v)))
        .join(";")
    )
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="financeiro.csv"`,
    },
  })
}
