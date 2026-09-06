"use client"

import { useState, useTransition } from "react"
import { Check, Copy, Video, VideoOff } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatusDot } from "@/components/shared/status-dot"
import { cn } from "@/lib/utils"
import {
  createInviteAction,
  endCallAction,
  openCallAction,
} from "../actions/telehealth.actions"

type Props = {
  queueEntryId: string
  patientName: string
  /** Sala já aberta neste atendimento, quando houver. */
  initialCallId: string | null
  /** Sem credenciais o painel se explica em vez de oferecer um botão que falha. */
  configured: boolean
}

/**
 * Teleconsulta dentro do atendimento.
 *
 * O link nasce AQUI, e não na agenda ou na ficha, por uma razão de contabilidade: a sala
 * só existe enquanto o atendimento está aberto, então o tempo dentro dela é o mesmo tempo
 * que o cronômetro mede, que entra no tempo efetivo e na produtividade. Gerado na marcação,
 * o paciente entraria quando quisesse e a consulta aconteceria fora do que o sistema conta.
 *
 * Por isso o servidor recusa abrir a sala antes de "Iniciar atendimento" — este painel
 * apenas mostra o motivo; quem decide é a Server Action.
 */
export function TelehealthPanel({
  queueEntryId,
  patientName,
  initialCallId,
  configured,
}: Props) {
  const [callId, setCallId] = useState<string | null>(initialCallId)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  function abrirSala() {
    startTransition(async () => {
      const result = await openCallAction(queueEntryId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setCallId(result.callId ?? null)
      toast.success("Sala aberta. Gere o link para o paciente.")
    })
  }

  function gerarLink() {
    if (!callId) return
    startTransition(async () => {
      const form = new FormData()
      form.set("display_name", patientName)
      const result = await createInviteAction(callId, form)
      if (result.error) {
        toast.error(result.error)
        return
      }
      // A action devolve o caminho; a URL absoluta é montada aqui, no navegador, para
      // acompanhar o host de onde a clínica realmente acessa o sistema.
      setInviteUrl(`${window.location.origin}${result.url}`)
      setCopied(false)
      toast.success("Link gerado. Válido por 24 horas.")
    })
  }

  async function copiar() {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      toast.success("Link copiado.")
    } catch {
      // Área de transferência bloqueada (contexto sem HTTPS, permissão negada): o link
      // continua visível e selecionável no campo, então nada se perde.
      toast.error("Não foi possível copiar. Selecione o link e copie à mão.")
    }
  }

  function encerrar() {
    if (!callId) return
    startTransition(async () => {
      const result = await endCallAction(callId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setCallId(null)
      setInviteUrl(null)
      toast.success("Chamada encerrada e link revogado.")
    })
  }

  return (
    <section className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2">
        <Video className="size-4 text-muted-foreground" aria-hidden />
        <h2 className="text-[0.7rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          Teleconsulta
        </h2>
        {callId && <StatusDot tone="success" label="Sala aberta" />}
      </div>

      {!configured ? (
        <p className="text-[0.8rem] text-muted-foreground">
          Indisponível neste ambiente: as credenciais do LiveKit não estão configuradas.
        </p>
      ) : !callId ? (
        <>
          <p className="text-[0.8rem] text-muted-foreground">
            A sala é aberta com o atendimento em curso, para o tempo da chamada contar como
            tempo de atendimento.
          </p>
          <Button onClick={abrirSala} disabled={isPending}>
            <Video className="size-4" aria-hidden />
            {isPending ? "Abrindo..." : "Abrir sala de vídeo"}
          </Button>
        </>
      ) : (
        <>
          {inviteUrl ? (
            <div className="grid gap-1.5">
              <Label htmlFor="telehealth-link">Link do paciente</Label>
              <div className="flex gap-1.5">
                <Input
                  id="telehealth-link"
                  readOnly
                  value={inviteUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="font-mono text-[0.75rem]"
                />
                <Button variant="outline" size="icon" onClick={copiar} aria-label="Copiar link">
                  {copied ? (
                    <Check className="size-4 text-status-success" aria-hidden />
                  ) : (
                    <Copy className="size-4" aria-hidden />
                  )}
                </Button>
              </div>
              <p className="text-[0.72rem] text-muted-foreground">
                Válido por 24 horas. Encerrar a chamada revoga o link.
              </p>
            </div>
          ) : (
            <Button variant="outline" onClick={gerarLink} disabled={isPending}>
              {isPending ? "Gerando..." : "Gerar link do paciente"}
            </Button>
          )}

          <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
            <Button
              nativeButton={false}
              render={<a href={`/profissional/chamada/${callId}`} target="_blank" rel="noreferrer" />}
            >
              Entrar na sala
            </Button>
            <Button
              variant="ghost"
              className={cn("ml-auto text-destructive")}
              onClick={encerrar}
              disabled={isPending}
            >
              <VideoOff className="size-4" aria-hidden />
              Encerrar chamada
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
