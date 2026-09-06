"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useDataChannel, useLocalParticipant } from "@livekit/components-react"
import { Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export const CHAT_MAX_LENGTH = 2000

export type ChatMessage = {
  id: string
  senderIdentity: string
  senderName: string
  body: string
  sentAt: string
}

/** O que trafega no data channel. `type` separa conversa de "digitando". */
type ChatPayload =
  | { type: "chat"; id: string; senderName: string; body: string; sentAt: string }
  | { type: "typing" }

/**
 * Só `http` e `https` viram link.
 *
 * O corpo da mensagem é digitado por quem está na sala — e o paciente, do ponto de vista do
 * sistema, é um estranho. Sem esta checagem um `javascript:` colado no chat vira um link
 * clicável dentro da consulta. `new URL` também rejeita o que nem é URL, então o teste é o
 * mesmo para as duas coisas.
 */
function linkSeguro(texto: string): string | null {
  try {
    const url = new URL(texto)
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null
  } catch {
    return null
  }
}

/**
 * O corpo da mensagem, como TEXTO.
 *
 * Nada de `dangerouslySetInnerHTML` aqui nem em lugar nenhum deste arquivo: o React escapa
 * o que passa por `{}`, e é essa a defesa. As palavras que forem URL viram link depois de
 * validado o esquema; o resto continua texto, inclusive o que se parecer com marcação.
 */
function CorpoDaMensagem({ body }: { body: string }) {
  return (
    <>
      {body.split(/(\s+)/).map((pedaco, i) => {
        const href = linkSeguro(pedaco)
        return href ? (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="underline underline-offset-2"
          >
            {pedaco}
          </a>
        ) : (
          <span key={i}>{pedaco}</span>
        )
      })}
    </>
  )
}

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

/**
 * O chat da consulta.
 *
 * Duas camadas, de propósito:
 *
 * - **Transporte:** o data channel do LiveKit entrega no mesmo caminho da mídia, então a
 *   mensagem aparece do outro lado sem servidor intermediário e sem WebSocket próprio.
 * - **Memória:** cada envio também é gravado pelo servidor, e o histórico é lido ao abrir.
 *   É o que faz quem entra atrasado ver o que já foi dito, e o que sobrevive a um F5 —
 *   o data channel sozinho perde tudo ao recarregar.
 *
 * As duas pontas fazem a mesma coisa por caminhos diferentes: o profissional por Server
 * Action, o paciente pelo endpoint do convite. Daí `loadHistory` e `persist` virem de fora.
 */
export function CallChat({
  loadHistory,
  persist,
  selfIdentity,
  selfName,
  onUnreadChange,
  visible,
}: {
  loadHistory: () => Promise<ChatMessage[]>
  persist: (body: string) => Promise<ChatMessage | null>
  selfIdentity: string
  selfName: string
  /** Avisa o painel de fora quantas chegaram enquanto o chat estava fechado. */
  onUnreadChange?: (count: number) => void
  visible: boolean
}) {
  const { localParticipant } = useLocalParticipant()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [texto, setTexto] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [digitandoOutro, setDigitandoOutro] = useState(false)
  const fimDaLista = useRef<HTMLDivElement>(null)
  const naoLidas = useRef(0)

  // --- histórico ---------------------------------------------------------
  useEffect(() => {
    let vivo = true
    loadHistory()
      .then((historico) => {
        if (vivo) setMessages(historico)
      })
      .catch(() => {
        if (vivo) setErro("Não foi possível carregar as mensagens anteriores.")
      })
    return () => {
      vivo = false
    }
  }, [loadHistory])

  // --- recepção pelo data channel ----------------------------------------
  const aoReceber = useCallback(
    (payload: { payload: Uint8Array }) => {
      let dados: ChatPayload
      try {
        dados = JSON.parse(new TextDecoder().decode(payload.payload)) as ChatPayload
      } catch {
        // Pacote de outra origem ou corrompido: ignorar é mais seguro que adivinhar.
        return
      }

      if (dados.type === "typing") {
        setDigitandoOutro(true)
        window.setTimeout(() => setDigitandoOutro(false), 2500)
        return
      }

      if (dados.type !== "chat" || typeof dados.body !== "string") return

      setMessages((atual) => {
        if (atual.some((m) => m.id === dados.id)) return atual
        return [
          ...atual,
          {
            id: dados.id,
            senderIdentity: "remoto",
            senderName: dados.senderName,
            body: dados.body.slice(0, CHAT_MAX_LENGTH),
            sentAt: dados.sentAt,
          },
        ]
      })
    },
    []
  )

  const { send } = useDataChannel("chat", aoReceber)

  // --- não lidas e rolagem ------------------------------------------------
  useEffect(() => {
    if (visible) {
      naoLidas.current = 0
      onUnreadChange?.(0)
      fimDaLista.current?.scrollIntoView({ block: "end" })
    }
  }, [messages, visible, onUnreadChange])

  useEffect(() => {
    if (!visible && messages.length > 0) {
      naoLidas.current += 1
      onUnreadChange?.(naoLidas.current)
    }
    // Só o comprimento importa: reagir ao array inteiro recontaria a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length])

  async function enviar() {
    const corpo = texto.trim()
    if (!corpo || enviando) return
    if (corpo.length > CHAT_MAX_LENGTH) {
      setErro(`Máximo de ${CHAT_MAX_LENGTH} caracteres.`)
      return
    }

    setEnviando(true)
    setErro(null)
    try {
      // Grava primeiro: o id vem do banco, e é ele que dedupe os dois lados.
      const salva = await persist(corpo)
      const mensagem: ChatMessage = salva ?? {
        id: crypto.randomUUID(),
        senderIdentity: selfIdentity,
        senderName: selfName,
        body: corpo,
        sentAt: new Date().toISOString(),
      }

      setMessages((atual) => [...atual, mensagem])
      setTexto("")

      const payload: ChatPayload = {
        type: "chat",
        id: mensagem.id,
        senderName: selfName,
        body: corpo,
        sentAt: mensagem.sentAt,
      }
      send(new TextEncoder().encode(JSON.stringify(payload)), { reliable: true })
    } catch {
      setErro("Não foi possível enviar. Tente de novo.")
    } finally {
      setEnviando(false)
    }
  }

  function avisarQueDigita() {
    if (!localParticipant) return
    const payload: ChatPayload = { type: "typing" }
    // Efêmero e sem garantia de entrega: perder um "digitando" não custa nada.
    send(new TextEncoder().encode(JSON.stringify(payload)), { reliable: false })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-[0.8rem] text-white/50">
            Nenhuma mensagem ainda.
          </p>
        ) : (
          messages.map((m) => {
            const meu = m.senderIdentity === selfIdentity
            return (
              <div key={m.id} className={cn("flex", meu ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2",
                    meu ? "bg-primary text-primary-foreground" : "bg-white/10 text-white"
                  )}
                >
                  {!meu && (
                    <p className="text-[0.7rem] font-medium opacity-70">{m.senderName}</p>
                  )}
                  <p className="text-[0.85rem] break-words whitespace-pre-wrap">
                    <CorpoDaMensagem body={m.body} />
                  </p>
                  <p className="mt-0.5 text-[0.65rem] tabular-nums opacity-60">{hora(m.sentAt)}</p>
                </div>
              </div>
            )
          })
        )}
        {digitandoOutro && (
          <p className="text-[0.75rem] text-white/50">digitando…</p>
        )}
        <div ref={fimDaLista} />
      </div>

      {erro && (
        <p className="px-3 pb-1 text-[0.75rem] text-status-danger" role="alert">
          {erro}
        </p>
      )}

      <div className="flex items-end gap-1.5 border-t border-white/10 p-2">
        <Textarea
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value.slice(0, CHAT_MAX_LENGTH))
            avisarQueDigita()
          }}
          onKeyDown={(e) => {
            // Enter envia; Shift+Enter quebra linha — a convenção que todo mundo já conhece.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              void enviar()
            }
          }}
          placeholder="Escreva uma mensagem"
          rows={2}
          className="min-h-0 resize-none border-white/15 bg-white/5 text-white placeholder:text-white/40"
          aria-label="Mensagem"
        />
        <Button size="icon" onClick={enviar} disabled={enviando || !texto.trim()} aria-label="Enviar">
          <Send className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
