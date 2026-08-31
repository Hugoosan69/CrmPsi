"use client"

import { useQuery } from "@tanstack/react-query"
import { BellRing, Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatTime } from "@/utils/datetime"
import { pendingCallsAction } from "../actions/queue.actions"

/**
 * Quem está sendo chamado agora, no topo da fila e em corpo grande.
 *
 * A linha na tabela já mostra "Chamado" com o ponto pulsando, mas é uma linha entre outras —
 * a recepcionista tem de procurar. Esta faixa existe para ser lida de relance, de pé e a
 * algum passo da tela, que é a situação real em que a informação é usada.
 *
 * Difere do cartão do canto por propósito: o cartão alerta quem está em OUTRA tela e sai ao
 * ser marcado; esta faixa é o estado da fila e fica de pé enquanto o paciente não entrar,
 * mostrando também quem já avisou — o que importa quando há duas pessoas no balcão.
 *
 * Usa a MESMA consulta do avisador, de propósito: a chave do TanStack Query é a mesma, então
 * as duas se resolvem numa requisição só, e nenhuma das duas precisa derivar por conta
 * própria se a chamada já foi avisada.
 */
export function CallingNow() {
  const { data } = useQuery({
    queryKey: ["queue", "chamadas"],
    queryFn: () => pendingCallsAction(),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    retry: false,
  })

  const chamadas = data ?? []
  if (chamadas.length === 0) return null

  return (
    <section
      aria-label="Pacientes sendo chamados"
      className="rounded-xl border border-status-info/40 bg-status-info/[0.06] p-4"
    >
      <p className="flex items-center gap-2 text-[0.72rem] font-semibold tracking-wide text-status-info uppercase">
        <BellRing className="size-3.5" aria-hidden />
        Chamando agora — avise o paciente
      </p>
      <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
        {chamadas.map((chamada) => {
          const avisado = Boolean(chamada.acknowledgedAt)
          return (
            <li
              key={chamada.id}
              className={cn(
                "flex items-baseline justify-between gap-3 rounded-lg px-3 py-2",
                // Avisado recua para o fundo em vez de sumir: o paciente ainda está no
                // caminho da sala, e a fila é o lugar onde isso continua visível.
                avisado ? "bg-card/60" : "bg-card"
              )}
            >
              <span className="min-w-0">
                <span
                  className={cn(
                    "block truncate text-[1.02rem] leading-tight font-semibold",
                    avisado && "text-muted-foreground"
                  )}
                >
                  {chamada.patientName}
                </span>
                <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[0.75rem] text-muted-foreground">
                  {avisado ? (
                    <>
                      <Check className="size-3 shrink-0 text-status-success" aria-hidden />
                      <span className="truncate">
                        {chamada.acknowledgedBy
                          ? `Avisado por ${chamada.acknowledgedBy}`
                          : "Já avisado"}
                      </span>
                    </>
                  ) : (
                    <span className="truncate">
                      {chamada.roomName
                        ? `Sala ${chamada.roomName}`
                        : chamada.professionalName || "Atendimento"}
                    </span>
                  )}
                </span>
              </span>
              <span className="shrink-0 text-[0.7rem] text-muted-foreground tabular-nums">
                {chamada.calledAt ? formatTime(chamada.calledAt) : ""}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
