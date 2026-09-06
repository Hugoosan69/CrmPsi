import { Info, Video } from "lucide-react"

import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { getTelehealthMonthlyLimit } from "@/services/clinic-settings.service"
import { getTelehealthUsage } from "@/services/telehealth.service"
import { isLiveKitConfigured } from "@/lib/livekit/env"
import { StatusDot } from "@/components/shared/status-dot"
import { cn } from "@/lib/utils"
import { TelehealthLimitForm } from "./telehealth-limit-form"

/** Primeiro instante e último do mês corrente, no fuso da clínica. */
function currentMonth() {
  const agora = new Date()
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1)
  const fim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59, 999)
  return { from: inicio.toISOString(), to: fim.toISOString(), label: inicio }
}

/**
 * Consumo de teleconsulta no mês.
 *
 * **Este número é a medida do CSIB, não a fatura do LiveKit.** Conta o tempo entre a
 * entrada do profissional na sala e o encerramento, arredondando cada chamada para cima.
 * O provedor cobra por participante-minuto, com regras próprias de arredondamento, então
 * os dois totais não vão bater — e não deveriam ser comparados como se fossem a mesma
 * coisa. Serve para a clínica saber quanto está usando, que é o que foi pedido.
 */
export async function TelehealthUsagePanel() {
  const membership = await requirePermission(PERMISSIONS.SETTINGS_MANAGE)
  const supabase = await createClient()
  const periodo = currentMonth()

  const [uso, limite] = await Promise.all([
    getTelehealthUsage(supabase, membership.clinicId, periodo),
    getTelehealthMonthlyLimit(supabase, membership.clinicId),
  ])

  const restante = limite > 0 ? Math.max(0, limite - uso.usedMinutes) : null
  const proporcao = limite > 0 ? Math.min(1, uso.usedMinutes / limite) : 0
  const tom = proporcao >= 1 ? "danger" : proporcao >= 0.8 ? "warning" : "success"

  const mes = periodo.label.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })

  return (
    <section className="grid gap-4">
      <div className="grid gap-1">
        <h2 className="flex items-center gap-1.5 font-heading text-[0.95rem] font-semibold">
          <Video className="size-4 text-muted-foreground" aria-hidden />
          Consumo de teleconsulta
        </h2>
        <p className="text-[0.8rem] text-muted-foreground">
          Minutos de sala usados em {mes}. Controle interno: o valor é medido pelo próprio
          sistema, entre a entrada do profissional e o encerramento da chamada.
        </p>
      </div>

      {!isLiveKitConfigured() && (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-[0.8rem] text-muted-foreground">
          A teleconsulta não está configurada neste ambiente — o consumo abaixo reflete
          apenas o que já foi registrado.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Metrica rotulo="Usados no mês" valor={`${uso.usedMinutes} min`} destaque />
        <Metrica
          rotulo="Restantes"
          valor={restante === null ? "sem limite" : `${restante} min`}
        />
        <Metrica rotulo="Chamadas encerradas" valor={String(uso.countedCalls)} />
      </div>

      {limite > 0 && (
        <div className="grid gap-1.5">
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={uso.usedMinutes}
            aria-valuemin={0}
            aria-valuemax={limite}
            aria-label="Minutos usados no mês"
          >
            <div
              className={cn(
                "h-full rounded-full transition-all",
                tom === "danger" && "bg-status-danger",
                tom === "warning" && "bg-status-warning",
                tom === "success" && "bg-status-success"
              )}
              style={{ width: `${Math.max(2, proporcao * 100)}%` }}
            />
          </div>
          <StatusDot
            tone={tom}
            label={
              proporcao >= 1
                ? `Limite de ${limite} min atingido`
                : `${uso.usedMinutes} de ${limite} min`
            }
          />
        </div>
      )}

      {uso.openCalls > 0 && (
        <p className="flex items-start gap-1.5 text-[0.78rem] text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {uso.openCalls} chamada(s) ainda em aberto não entram na conta — só somam depois de
          encerradas. Encerrar pelo painel do atendimento é o que fecha a duração.
        </p>
      )}

      <TelehealthLimitForm currentLimit={limite} />
    </section>
  )
}

function Metrica({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string
  valor: string
  destaque?: boolean
}) {
  return (
    <div className="grid gap-0.5 rounded-xl border border-border bg-card p-3">
      <span
        className={cn(
          "metric font-semibold tabular-nums",
          destaque ? "text-2xl" : "text-lg text-muted-foreground"
        )}
      >
        {valor}
      </span>
      <span className="text-[0.75rem] text-muted-foreground">{rotulo}</span>
    </div>
  )
}
