import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { FinancialSummary } from "@/services/financial.service"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

/** Visões agregadas do requisito 7 — "destrinchar ao máximo" a receita paga no período
 * filtrado. Ver a nota de atribuição em `getFinancialSummary` (financial.service.ts). */
export function FinancialSummaryCards({
  summary,
  showProfessionalBreakdown = true,
}: {
  summary: FinancialSummary
  /** Falso em "Meu financeiro": a quebra por profissional teria uma linha só, a da
   * própria pessoa — informação que o título da página já dá. */
  showProfessionalBreakdown?: boolean
}) {
  const total = summary.avulsaTotal + summary.pacoteTotal

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Receita avulsa</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">{formatCurrency(summary.avulsaTotal)}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Receita de pacotes</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">{formatCurrency(summary.pacoteTotal)}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total no período</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">{formatCurrency(total)}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Ticket médio</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">{formatCurrency(summary.averageTicket)}</CardContent>
      </Card>

      {showProfessionalBreakdown && summary.byProfessional.length > 0 && (
        <Card className="sm:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receita avulsa por profissional
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1.5 text-sm">
            {summary.byProfessional.map((p) => (
              <div key={p.professionalId} className="flex items-center justify-between">
                <span>{p.professionalName}</span>
                <span className="font-medium">{formatCurrency(p.total)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {summary.bySpecialty.length > 0 && (
        <Card className="sm:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receita de pacotes por especialidade
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1.5 text-sm">
            {summary.bySpecialty.map((s) => (
              <div key={s.specialtyId} className="flex items-center justify-between">
                <span>{s.specialtyName}</span>
                <span className="font-medium">{formatCurrency(s.total)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
