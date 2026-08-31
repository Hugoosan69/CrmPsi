"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { BellRing, Check, VolumeX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { prepararToque, tocarChamada, toqueDisponivel } from "@/lib/call-chime"
import { pendingCallsAction } from "../actions/queue.actions"

/**
 * Avisa a recepção quando um profissional chama um paciente.
 *
 * O profissional aperta "chamar" no consultório e não tem como falar com a sala de espera
 * dali. Quem fala com o paciente é a recepção — e ela raramente está com a tela da fila
 * aberta, então o aviso precisa alcançá-la em qualquer lugar do sistema. Daí este componente
 * viver na moldura da aplicação, e não numa página.
 *
 * Quatro sinais, porque um só falha: som (a pessoa pode estar de olho em outra coisa),
 * cartão no canto (o som pode estar bloqueado ou o volume baixo), notificação no sino
 * (registro que sobrevive a fechar o cartão) e destaque na fila (para quem chegar depois).
 *
 * Consulta em intervalo, não Realtime. Migração 004 publica as tabelas para replicação, mas
 * uma clínica com replicação desligada no projeto continuaria sem aviso nenhum — e este é
 * exatamente o recurso que não pode depender de configuração de infraestrutura. Cinco
 * segundos é o mesmo ritmo do quadro da fila.
 */
const INTERVALO_MS = 5000

export function CallAnnouncer() {
  const { data } = useQuery({
    queryKey: ["queue", "chamadas"],
    queryFn: () => pendingCallsAction(),
    refetchInterval: INTERVALO_MS,
    refetchOnWindowFocus: true,
    retry: false,
  })

  // Ids já anunciados. Guardados em ref porque a lista só existe para decidir se o som toca
  // — não deve provocar renderização, e um estado aqui causaria laço com o efeito.
  const anunciados = useRef<Set<string> | null>(null)
  const [dispensados, setDispensados] = useState<string[]>([])
  const [semSom, setSemSom] = useState(false)

  useEffect(() => prepararToque(), [])

  const chamadas = (data ?? []).filter((c) => !dispensados.includes(c.id))

  useEffect(() => {
    const atuais = new Set((data ?? []).map((c) => c.id))

    // Primeira resposta: registra o que já estava chamado sem tocar nada. Sem isto, abrir
    // uma tela nova tocaria o aviso de chamadas antigas, e o som viraria ruído a ser
    // ignorado — que é o oposto do que ele existe para fazer.
    if (anunciados.current === null) {
      anunciados.current = atuais
      return
    }

    const novas = [...atuais].filter((id) => !anunciados.current!.has(id))
    // Ids que saíram (paciente entrou no consultório) são esquecidos, para que a mesma
    // pessoa chamada de novo depois volte a tocar.
    anunciados.current = atuais

    if (novas.length === 0) return

    tocarChamada()
    setSemSom(!toqueDisponivel())
    // Uma chamada nova reabre o cartão de quem tinha sido dispensado antes.
    setDispensados((anteriores) => anteriores.filter((id) => atuais.has(id) && !novas.includes(id)))
  }, [data])

  if (chamadas.length === 0) return null

  return (
    <div
      // aria-live para leitor de tela: a chamada chega sem a pessoa ter feito nada, então
      // precisa ser anunciada, não apenas desenhada.
      role="status"
      aria-live="assertive"
      className="pointer-events-none fixed inset-x-3 bottom-3 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[22rem]"
    >
      {semSom && (
        <div className="pointer-events-auto flex w-full items-center gap-2 rounded-lg border border-status-warning/40 bg-status-warning/10 px-3 py-2 text-[0.72rem] text-status-warning">
          <VolumeX className="size-3.5 shrink-0" aria-hidden />
          <span>Som bloqueado pelo navegador. Clique em qualquer lugar para liberar.</span>
        </div>
      )}

      {chamadas.map((chamada) => (
        <div
          key={chamada.id}
          className="pointer-events-auto w-full animate-fade-in-up rounded-xl border border-status-info/40 bg-card p-3.5 shadow-lg"
        >
          <div className="flex items-start gap-2.5">
            <span
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-status-info/12 text-status-info"
              aria-hidden
            >
              <BellRing className="size-4" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[0.7rem] font-semibold tracking-wide text-status-info uppercase">
                Chamar na recepção
              </p>
              {/* O nome grande é o ponto: a recepcionista precisa ler de relance e falar
                  em voz alta, muitas vezes de pé e a algum passo da tela. */}
              <p className="mt-0.5 truncate text-[1.05rem] leading-tight font-semibold">
                {chamada.patientName}
              </p>
              <p className="mt-1 text-[0.78rem] text-muted-foreground">
                {chamada.roomName
                  ? `Encaminhe para a sala ${chamada.roomName}`
                  : chamada.professionalName
                    ? `Encaminhe para ${chamada.professionalName}`
                    : "Encaminhe para o atendimento"}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <Button
              nativeButton={false}
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[0.75rem]"
              render={<Link href="/recepcao/fila">Ver a fila</Link>}
            />
            <Button
              size="sm"
              className="h-7 px-2.5 text-[0.75rem]"
              onClick={() => setDispensados((anteriores) => [...anteriores, chamada.id])}
            >
              <Check className="size-3.5" />
              Avisei o paciente
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
