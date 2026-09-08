import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { listGuides } from "@/services/billing.service"
import { GuidesTable } from "./guides-table"

/**
 * As guias de convênio deste paciente.
 *
 * Vive na ficha porque é onde a pergunta nasce: o paciente liga perguntando se a guia do
 * mês passado foi enviada, ou o convênio pede a segunda via. Sem isto, achar uma guia
 * exigia lembrar em que atendimento ela foi emitida e abrir o detalhe do lançamento.
 *
 * A contagem por mês fica à vista porque é o que decide se o próximo atendimento é pelo
 * convênio ou particular — o limite mensal (migration 032) é por paciente, e quem atende no
 * balcão precisa saber onde ele está antes de prometer alguma coisa.
 */
export async function PatientGuidesPanel({
  clinicId,
  patientId,
  canManage,
}: {
  clinicId: string
  patientId: string
  /** `billing.manage` — governa só a exclusão; ver e enviar é `billing.view`. */
  canManage: boolean
}) {
  const supabase = await createClient()
  const guias = await listGuides(supabase, clinicId, { patientId })

  const inicioDoMes = new Date()
  inicioDoMes.setDate(1)
  inicioDoMes.setHours(0, 0, 0, 0)
  const noMes = guias.filter((g) => new Date(g.issuedAt) >= inicioDoMes)

  const porConvenioNoMes = new Map<string, number>()
  for (const g of noMes) {
    porConvenioNoMes.set(g.insurerName, (porConvenioNoMes.get(g.insurerName) ?? 0) + 1)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">Guias de convênio</CardTitle>
        {porConvenioNoMes.size > 0 && (
          <p className="text-[0.78rem] text-muted-foreground">
            Neste mês:{" "}
            {[...porConvenioNoMes.entries()]
              .map(([convenio, quantas]) => `${quantas} do ${convenio}`)
              .join(" · ")}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <GuidesTable
          guides={guias}
          showPatient={false}
          canManage={canManage}
          emptyTitle="Nenhuma guia emitida para este paciente"
          emptyDescription="As guias aparecem aqui quando o atendimento é registrado como convênio no momento do pagamento."
        />
      </CardContent>
    </Card>
  )
}
