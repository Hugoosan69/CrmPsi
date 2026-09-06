"use client"

import { useEffect, useState } from "react"
import { LiveKitRoom } from "@livekit/components-react"
import "@livekit/components-styles"

import { Skeleton } from "@/components/ui/skeleton"
import { StatusDot } from "@/components/shared/status-dot"
import { CallStage, mensagemDeFalhaDeMidia } from "./call-stage"

type Acesso =
  | { estado: "carregando" }
  | {
      estado: "pronto"
      token: string
      serverUrl: string
      displayName: string
      /** `invite:<id>` — a mesma identidade que o servidor pôs no token. */
      identity: string
    }
  | { estado: "recusado"; mensagem: string }
  | { estado: "encerrado" }

/**
 * A sala do paciente.
 *
 * Uma tela e só. Sem menu, sem link para o sistema, sem nada que leve a outra parte do
 * CSIB — o paciente não é usuário do CRM, é alguém que recebeu um endereço para uma
 * consulta, como num Meet. Tudo que ele pode fazer aqui é entrar, conversar e sair.
 *
 * Quando o acesso é recusado (link expirado, revogado, consulta encerrada) a tela diz o que
 * houve e para. Não oferece login: não há conta para ele entrar, e mandá-lo a um formulário
 * de funcionário seria pior do que não dizer nada.
 */
export function PatientRoom({ token: inviteToken }: { token: string }) {
  const [acesso, setAcesso] = useState<Acesso>({ estado: "carregando" })
  const [falhaDeMidia, setFalhaDeMidia] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    fetch(`/api/telehealth/c/${encodeURIComponent(inviteToken)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!vivo) return
        if (!res.ok || !body.token) {
          setAcesso({
            estado: "recusado",
            mensagem: body.error ?? "Não foi possível entrar na consulta.",
          })
          return
        }
        // A identidade sai do próprio token: é o servidor quem a define, e lê-la daqui
        // evita uma segunda fonte de verdade sobre quem é este participante.
        let identity = "eu"
        try {
          identity = JSON.parse(atob(body.token.split(".")[1])).sub ?? "eu"
        } catch {
          // Token em formato inesperado: o chat ainda funciona, só não destaca as próprias
          // mensagens. Não é motivo para barrar a consulta.
        }
        setAcesso({
          estado: "pronto",
          token: body.token,
          serverUrl: body.serverUrl,
          displayName: body.displayName,
          identity,
        })
      })
      .catch(() => {
        if (vivo) {
          setAcesso({
            estado: "recusado",
            mensagem: "Não foi possível conectar. Verifique sua internet e tente de novo.",
          })
        }
      })
    return () => {
      vivo = false
    }
  }, [inviteToken])

  if (acesso.estado === "carregando") {
    return <Skeleton className="h-[70vh] w-full rounded-xl" />
  }

  if (acesso.estado === "encerrado") {
    return (
      <Aviso
        titulo="Consulta encerrada"
        descricao="Você já pode fechar esta janela. Obrigado."
        tom="neutro"
      />
    )
  }

  if (acesso.estado === "recusado") {
    return <Aviso titulo="Não foi possível entrar" descricao={acesso.mensagem} tom="alerta" />
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.85rem] text-muted-foreground">
          Você está entrando como <span className="font-medium text-foreground">{acesso.displayName}</span>
        </p>
        <StatusDot tone="success" label="Conexão segura" />
      </div>

      {falhaDeMidia && (
        <p
          className="rounded-lg border border-status-warning/40 bg-status-warning/[0.06] px-3 py-2 text-[0.8rem]"
          role="alert"
        >
          {falhaDeMidia}
        </p>
      )}

      <div className="h-[70vh]">
        <LiveKitRoom
          token={acesso.token}
          serverUrl={acesso.serverUrl}
          connect
          video
          audio
          style={{ height: "100%" }}
          onMediaDeviceFailure={(e) => setFalhaDeMidia(mensagemDeFalhaDeMidia(e))}
        >
          {/* Sem compartilhamento de tela: numa consulta o paciente não apresenta nada, e
              cada botão a menos é uma dúvida a menos para quem abriu isto pela primeira vez. */}
          <CallStage
            canShareScreen={false}
            onLeave={() => setAcesso({ estado: "encerrado" })}
            chat={{
              selfIdentity: acesso.identity,
              selfName: acesso.displayName,
              loadHistory: async () => {
                const res = await fetch(
                  `/api/telehealth/c/${encodeURIComponent(inviteToken)}/mensagens`
                )
                if (!res.ok) throw new Error("historico")
                return (await res.json()).messages
              },
              persist: async (body) => {
                const res = await fetch(
                  `/api/telehealth/c/${encodeURIComponent(inviteToken)}/mensagens`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ body }),
                  }
                )
                if (!res.ok) throw new Error("envio")
                return (await res.json()).message
              },
            }}
          />
        </LiveKitRoom>
      </div>

      <p className="text-center text-[0.75rem] text-muted-foreground">
        Se a imagem ou o som falharem, verifique se o navegador tem permissão para usar a
        câmera e o microfone.
      </p>
    </div>
  )
}

/** Fim de linha para o paciente: uma mensagem, sem saída para lugar nenhum. */
function Aviso({
  titulo,
  descricao,
  tom,
}: {
  titulo: string
  descricao: string
  tom: "neutro" | "alerta"
}) {
  return (
    <div className="grid place-items-center py-16">
      <div className="grid max-w-md gap-3 rounded-xl border border-border bg-card p-8 text-center">
        <StatusDot
          tone={tom === "alerta" ? "warning" : "neutral"}
          label={tom === "alerta" ? "Acesso indisponível" : "Encerrada"}
          className="justify-center"
        />
        <h1 className="font-heading text-lg font-semibold">{titulo}</h1>
        <p className="text-[0.875rem] text-muted-foreground">{descricao}</p>
        <p className="text-[0.75rem] text-muted-foreground">
          Em caso de dúvida, fale com a clínica pelo mesmo canal em que recebeu este link.
        </p>
      </div>
    </div>
  )
}
