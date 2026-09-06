"use client"

import { useEffect, useState } from "react"
import { LiveKitRoom, VideoConference } from "@livekit/components-react"
import "@livekit/components-styles"

import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { issueProfessionalTokenAction } from "../actions/telehealth.actions"

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
 *
 * `VideoConference` traz grade, controles e compartilhamento de tela prontos — a spec
 * recomenda preferi-lo a montar a grade à mão, e é o que evita reimplementar seleção de
 * dispositivo e reconexão. O chat que vem embutido usa o data channel e **não persiste**;
 * a fase 3 o substitui pelo painel próprio, que grava e recarrega o histórico.
 */
export function CallRoom({ callId }: { callId: string }) {
  const [conexao, setConexao] = useState<Conexao>({ estado: "carregando" })

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
    return <Skeleton className="h-[70vh] w-full rounded-xl" />
  }

  if (conexao.estado === "erro") {
    return (
      <EmptyState
        title="Não foi possível entrar na sala"
        description={conexao.mensagem}
        showMascot={false}
        action={
          <Button variant="outline" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        }
      />
    )
  }

  return (
    <div className="h-[75vh] overflow-hidden rounded-xl border border-border">
      <LiveKitRoom
        token={conexao.token}
        serverUrl={conexao.serverUrl}
        connect
        video
        audio
        data-lk-theme="default"
        style={{ height: "100%" }}
        onDisconnected={() => window.close()}
      >
        <VideoConference />
      </LiveKitRoom>
    </div>
  )
}
