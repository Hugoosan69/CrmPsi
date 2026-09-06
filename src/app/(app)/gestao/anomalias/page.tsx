import Link from "next/link"
import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { detectAllAnomalies } from "@/services/process-anomalies.service"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AlertTriangle, AlertCircle, CheckCircle } from "lucide-react"

export default async function ProcessAnomaliesPage() {
  const membership = await requirePermission(PERMISSIONS.FINANCIAL_VIEW)
  const supabase = await createClient()

  const anomalies = await detectAllAnomalies(supabase, membership.clinicId)

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Anomalias de Processo"
        description="Monitoramento automático de erros e situações que requerem atenção."
      />

      {/* Sumário */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Críticas</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {anomalies.paymentNotQueued.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Pagamento confirmado, sem fila
            </p>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Avisos</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {anomalies.orphanedQueue.length + anomalies.stalePending.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Filas órfãs + pagamentos antigos
            </p>
          </CardContent>
        </Card>

        <Card className={anomalies.totalCount === 0 ? "border-green-200 bg-green-50" : ""}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              {anomalies.totalCount === 0 ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-orange-600" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {anomalies.totalCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {anomalies.totalCount === 0
                ? "Nenhuma anomalia"
                : "anomalias encontradas"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Atendimentos com pagamento confirmado mas não na fila */}
      {anomalies.paymentNotQueued.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <CardTitle>Pagamento confirmado, mas não na fila</CardTitle>
                <CardDescription>
                  Estes atendimentos têm pagamento confirmado mas não foram enviados para a fila do
                  profissional
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Profissional</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anomalies.paymentNotQueued.map((item: any, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{item.patientName}</TableCell>
                    <TableCell>{item.professionalName}</TableCell>
                    <TableCell>
                      {item.amount ? `R$ ${(item.amount / 100).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/recepcao/agenda?apt=${item.appointmentId}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Ver agendamento
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Fila órfã */}
      {anomalies.orphanedQueue.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <div>
                <CardTitle>Entradas na fila de atendimentos concluídos</CardTitle>
                <CardDescription>
                  A fila não foi limpa quando estes atendimentos foram concluídos
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Status do agendamento</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anomalies.orphanedQueue.map((item: any, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{item.patientName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.appointmentStatus}</Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/recepcao/agenda?apt=${item.appointmentId}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Ver agendamento
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Pagamentos pendentes antigos */}
      {anomalies.stalePending.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <div>
                <CardTitle>Pagamentos pendentes há muito tempo</CardTitle>
                <CardDescription>
                  Estes atendimentos estão aguardando pagamento há mais de 24 horas
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Pendente desde</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anomalies.stalePending.map((item: any, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{item.patientName}</TableCell>
                    <TableCell>{new Date(item.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>
                      <Link
                        href={`/recepcao/agenda?apt=${item.appointmentId}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Cobrar agora
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {anomalies.totalCount === 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <CardTitle>Tudo OK</CardTitle>
                <CardDescription>
                  Nenhuma anomalia detectada. O sistema está funcionando corretamente.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}
    </div>
  )
}
