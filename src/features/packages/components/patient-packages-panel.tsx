import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { listAllPatientPackages, listSessionPackages } from "@/services/packages.service"
import { listPaymentMethods } from "@/services/financial.service"
import { PackageProgressBar } from "./package-progress-bar"
import { SellPackageDialog } from "./sell-package-dialog"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value))
}

/**
 * O que dizer sobre a janela do pacote (migration 033).
 *
 * O texto muda com a urgência porque o número sozinho não age: "até 15/09" exige que quem
 * lê saiba a data de hoje e faça a conta. "Vence amanhã" é o que faz alguém agendar.
 *
 * Encerrado NÃO é erro: as sessões continuam podendo ser usadas — o paciente pagou por
 * elas. É um aviso para a clínica correr atrás, e o mesmo caso aparece na varredura de
 * anomalias com o número de sessões que sobraram.
 */
function periodo(periodEnd: string | null, restantes: number) {
  if (!periodEnd) return null

  const hoje = new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00Z`)
  const fim = new Date(`${periodEnd}T12:00:00Z`)
  const dias = Math.round((fim.getTime() - hoje.getTime()) / 86400000)
  const ate = `até ${formatDate(periodEnd)}`

  if (dias < 0) {
    return {
      texto: restantes > 0
        ? `Período encerrado em ${formatDate(periodEnd)} — ${restantes} sessão(ões) sem usar`
        : `Período encerrado em ${formatDate(periodEnd)}`,
      tom: restantes > 0 ? "alerta" : "neutro",
    } as const
  }
  if (dias === 0) return { texto: `Último dia do período (${ate.slice(5)})`, tom: "alerta" } as const
  if (dias <= 3) return { texto: `Vence em ${dias} dia(s) — ${ate}`, tom: "alerta" } as const
  return { texto: `Válido ${ate}`, tom: "neutro" } as const
}

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  completed: "Concluído",
  cancelled: "Cancelado",
}

export async function PatientPackagesPanel({
  clinicId,
  patientId,
  canManage,
}: {
  clinicId: string
  patientId: string
  canManage: boolean
}) {
  const supabase = await createClient()
  const [packages, catalog, paymentMethods] = await Promise.all([
    listAllPatientPackages(supabase, clinicId, patientId),
    canManage ? listSessionPackages(supabase, clinicId, { activeOnly: true }) : Promise.resolve([]),
    canManage ? listPaymentMethods(supabase, clinicId) : Promise.resolve([]),
  ])

  return (
    <div className="grid gap-4">
      {canManage && (
        <div className="flex justify-end">
          <SellPackageDialog patientId={patientId} packages={catalog} paymentMethods={paymentMethods} />
        </div>
      )}
      {packages.length === 0 ? (
        <EmptyState title="Este paciente não tem pacotes." />
      ) : (
        <div className="grid gap-3">
          {packages.map((p) => (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">
                  {p.specialtyName} — {p.packageName}
                </CardTitle>
                <Badge variant={p.status === "active" ? "default" : "secondary"}>
                  {STATUS_LABEL[p.status] ?? p.status}
                </Badge>
              </CardHeader>
              <CardContent className="grid gap-2">
                <PackageProgressBar used={p.sessions_used} total={p.total_sessions} />
                <p className="text-xs text-muted-foreground">
                  Comprado em {formatDate(p.purchased_at)} · {formatCurrency(Number(p.total_price))}
                </p>
                {(() => {
                  const janela = periodo(p.period_end, p.total_sessions - p.sessions_used)
                  if (!janela) return null
                  return (
                    <p
                      className={
                        janela.tom === "alerta"
                          ? "text-xs font-medium text-status-warning"
                          : "text-xs text-muted-foreground"
                      }
                    >
                      {janela.texto}
                    </p>
                  )
                })()}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
