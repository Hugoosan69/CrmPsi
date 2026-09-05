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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
