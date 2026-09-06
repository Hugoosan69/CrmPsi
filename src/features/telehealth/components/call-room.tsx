"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LiveKitRoom } from "@livekit/components-react"
import "@livekit/components-styles"

import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  issueProfessionalTokenAction,
  listMessagesAction,
  sendMessageAction,
} from "../actions/telehealth.actions"
import { CallStage, mensagemDeFalhaDeMidia } from "./call-stage"

type Conexao =
  | { estado: "carregando" }
  | { estado: "pronto"; token: string; serverUrl: string }
  | { estado: "erro"; mensagem: string }

/**
 * A sala do profissional.
 *
 * O token é pedido ao servidor ao montar, e não passado por props do componente de
 * servidor: ele vale 15 minutos para ENTRAR, então buscá-lo no momento em que a sala abre
 * evita a página renderizada e deixada aberta chegar na sala com um token vencido.
 */
export function CallRoom({
  callId,
  queueEntryId,
  selfIdentity,
  selfName,
}: {
  callId: string
  queueEntryId: string
  /** Do servidor: é a mesma identidade que vai no token, e é o que separa "minha
   *  mensagem" da do outro lado. */
  selfIdentity: string
  selfName: string
}) {
  const router = useRouter()
  const [conexao, setConexao] = useState<Conexao>({ estado: "carregando" })
  const [falhaDeMidia, setFalhaDeMidia] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    issueProfessionalTokenAction(callId).then((result) => {
      if (!vivo) return
      if (result.error || !result.token || !result.serverUrl) {
        setConexao({
          estado: "erro",
          mensagem: result.error ?? "Não foi possível obter acesso à sala.",
        })
        return
      }
      setConexao({ estado: "pronto", token: result.token, serverUrl: result.serverUrl })
    })
    return () => {
      vivo = false
    }
  }, [callId])

  if (conexao.estado === "carregando") {
    return <Skeleton className="h-[75vh] w-full rounded-xl" />
  }

  if (conexao.estado === "erro") {
    return (
      <EmptyState
        title="Não foi possível entrar na sala"
        description={conexao.mensagem}
        showMascot={false}
        action={
          <Button variant="outline" onClick={() => router.refresh()}>
            Tentar novamente
          </Button>
        }
      />
    )
  }

  return (
    <div className="grid h-[75vh] gap-2">
      {falhaDeMidia && (
        <p
          className="rounded-lg border border-status-warning/40 bg-status-warning/[0.06] px-3 py-2 text-[0.8rem]"
          role="alert"
        >
          {falhaDeMidia}
        </p>
      )}
      <LiveKitRoom
        token={conexao.token}
        serverUrl={conexao.serverUrl}
        connect
        video
        audio
        style={{ height: "100%" }}
        onMediaDeviceFailure={(e) => setFalhaDeMidia(mensagemDeFalhaDeMidia(e))}
      >
        {/* Sair devolve ao atendimento, não fecha a janela: o profissional continua
            trabalhando ali — prontuário, prescrição, encerrar o atendimento. */}
        <CallStage
          onLeave={() => router.push(`/profissional/atendimento/${queueEntryId}`)}
          chat={{
            selfIdentity,
            selfName,
            loadHistory: async () =>
              (await listMessagesAction(callId)).map((m) => ({
                id: m.id,
                senderIdentity: m.sender_identity,
                senderName: m.sender_name,
                body: m.body,
                sentAt: m.sent_at,
              })),
            persist: async (body) => {
              const r = await sendMessageAction(callId, body)
              if (r.error) throw new Error(r.error)
              // A action não devolve a linha; o histórico a traz na próxima abertura.
              return null
            },
          }}
        />
      </LiveKitRoom>
    </div>
  )
}
