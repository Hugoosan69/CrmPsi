"use client"

import { BellRing } from "lucide-react"

import { formatTime } from "@/utils/datetime"
import type { QueueEntryView } from "@/services/queue.service"

/**
 * Quem está sendo chamado agora, no topo e em corpo grande.
 *
 * A linha na tabela já mostra "Chamado" com o ponto pulsando, mas é uma linha entre outras —
 * a recepcionista tem de procurar. Esta faixa existe para ser lida de relance, de pé e a
 * algum passo da tela, que é a situação real em que a informação é usada.
 *
 * Difere do cartão do canto por propósito: o cartão alerta quem está em OUTRA tela e some ao
 * ser dispensado; esta faixa é o estado da fila e fica de pé enquanto o paciente não entrar,
 * inclusive para quem abrir a tela depois do aviso ter passado.
 */
export function CallingNow({ entries }: { entries: QueueEntryView[] }) {
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
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex items-baseline justify-between gap-3 rounded-lg bg-card px-3 py-2"
          >
            <span className="min-w-0">
              <span className="block truncate text-[1.02rem] leading-tight font-semibold">
                {entry.patientName}
              </span>
              <span className="mt-0.5 block truncate text-[0.75rem] text-muted-foreground">
                {entry.professionalName || "Atendimento"}
              </span>
            </span>
            <span className="shrink-0 text-[0.7rem] text-muted-foreground tabular-nums">
              {entry.called_at ? formatTime(entry.called_at) : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
