"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Send, Trash2, Users } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EmptyState } from "@/components/shared/empty-state"
import { cn } from "@/lib/utils"
import { formatRelativeTime, formatTime } from "@/utils/datetime"
import type { ConversationView } from "@/services/internal-chat.service"
import {
  listConversationsAction,
  listMessagesAction,
  markConversationReadAction,
  retractMessageAction,
  sendMessageAction,
} from "../actions/internal-chat.actions"
import { NewConversationDialog } from "./new-conversation-dialog"

type Contact = { id: string; fullName: string; email: string; roleName: string | null }

/** The open thread polls faster than the list; both stay modest since this screen sits open. */
const THREAD_POLL_MS = 8_000
const LIST_POLL_MS = 20_000

export function InternalChat({
  contacts,
  currentUserName,
}: {
  contacts: Contact[]
  currentUserName: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const activeId = searchParams.get("conversa")

  const conversations = useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: () => listConversationsAction(),
    refetchInterval: LIST_POLL_MS,
  })

  const list = conversations.data ?? []
  const active = list.find((c) => c.id === activeId) ?? null

  function selectConversation(id: string) {
    const params = new URLSearchParams(searchParams)
    params.set("conversa", id)
    router.push(`/mensagens?${params.toString()}`)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[19rem_1fr] lg:items-start">
      <div className="grid gap-3">
        <NewConversationDialog contacts={contacts} onOpened={selectConversation} />

        <div className="rounded-xl border border-border bg-card">
          {conversations.isPending ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Carregando conversas...</p>
          ) : conversations.isError ? (
            <div className="px-4 py-6">
              <p className="text-sm text-muted-foreground">Não foi possível carregar as conversas.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => conversations.refetch()}
              >
                Tentar novamente
              </Button>
            </div>
          ) : list.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma conversa ainda. Comece uma acima.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {list.map((conversation) => (
                <li key={conversation.id}>
                  <ConversationRow
                    conversation={conversation}
                    isActive={conversation.id === activeId}
                    onSelect={() => selectConversation(conversation.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {active ? (
        <Thread
          conversation={active}
          currentUserName={currentUserName}
          onChanged={() => {
            queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] })
            queryClient.invalidateQueries({ queryKey: ["notifications", "inbox"] })
          }}
        />
      ) : (
        <EmptyState
          title="Selecione uma conversa"
          description="Escolha uma conversa à esquerda, ou inicie uma nova com alguém da equipe."
        />
      )}
    </div>
  )
}

function ConversationRow({
  conversation,
  isActive,
  onSelect,
}: {
  conversation: ConversationView
  isActive: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isActive ? "true" : undefined}
      className={cn(
        "grid w-full gap-0.5 px-3.5 py-2.5 text-left transition-colors hover:bg-accent/50",
        isActive && "bg-accent/60"
      )}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          {conversation.kind === "group" && (
            <Users className="size-3.5 shrink-0 text-muted-foreground" aria-label="Grupo" />
          )}
          <span
            className={cn(
              "truncate text-[0.85rem]",
              conversation.unreadCount > 0 ? "font-semibold" : "font-medium"
            )}
          >
            {conversation.title}
          </span>
        </span>
        {conversation.lastMessageAt && (
          <span className="shrink-0 text-[0.68rem] text-muted-foreground tabular-nums">
            {formatRelativeTime(conversation.lastMessageAt)}
          </span>
        )}
      </span>
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-[0.75rem] text-muted-foreground">
          {conversation.lastMessagePreview ?? "Sem mensagens"}
        </span>
        {conversation.unreadCount > 0 && (
          <span className="flex min-w-4 shrink-0 items-center justify-center rounded-full bg-status-info px-1 text-[0.62rem] font-semibold text-white tabular-nums">
            {conversation.unreadCount}
          </span>
        )}
      </span>
    </button>
  )
}

function Thread({
  conversation,
  currentUserName,
  onChanged,
}: {
  conversation: ConversationView
  currentUserName: string
  onChanged: () => void
}) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState("")
  const [isSending, startSending] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)

  const messages = useQuery({
    queryKey: ["chat", "messages", conversation.id],
    queryFn: () => listMessagesAction(conversation.id),
    refetchInterval: THREAD_POLL_MS,
  })

  const items = messages.data ?? []

  // Opening a thread is reading it — otherwise the badge would stay lit while the
  // operator is looking straight at the messages.
  useEffect(() => {
    const id = setTimeout(() => {
      void markConversationReadAction(conversation.id).then(onChanged).catch(() => {})
    }, 400)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id, items.length])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [items.length])

  function submit() {
    const text = draft.trim()
    if (!text) return
    startSending(async () => {
      const result = await sendMessageAction(conversation.id, text)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setDraft("")
      await queryClient.invalidateQueries({ queryKey: ["chat", "messages", conversation.id] })
      onChanged()
    })
  }

  return (
    <div className="flex h-[calc(100vh-11rem)] min-h-80 flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        {conversation.kind === "group" && (
          <Users className="size-4 text-muted-foreground" aria-hidden />
        )}
        <div className="min-w-0">
          <p className="truncate text-[0.9rem] font-semibold">{conversation.title}</p>
          <p className="text-[0.72rem] text-muted-foreground">
            {conversation.kind === "group"
              ? `${conversation.participantIds.length} participantes`
              : "Conversa direta"}
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4 py-3">
        {messages.isPending ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando mensagens...</p>
        ) : messages.isError ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Não foi possível carregar as mensagens.</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => messages.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma mensagem ainda. Escreva a primeira abaixo.
          </p>
        ) : (
          <ul className="grid gap-2.5">
            {items.map((message, index) => {
              const previous = items[index - 1]
              const showSender =
                conversation.kind === "group" &&
                !message.isMine &&
                previous?.sender_id !== message.sender_id

              return (
                <li
                  key={message.id}
                  className={cn("flex flex-col", message.isMine ? "items-end" : "items-start")}
                >
                  {showSender && (
                    <span className="mb-0.5 px-1 text-[0.7rem] font-medium text-muted-foreground">
                      {message.senderName}
                    </span>
                  )}
                  <div
                    className={cn(
                      "group/msg max-w-[85%] rounded-xl px-3 py-2",
                      message.isMine
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                      message.deleted_at && "opacity-60"
                    )}
                  >
                    {message.deleted_at ? (
                      <p className="text-[0.82rem] italic">Mensagem apagada</p>
                    ) : (
                      <p className="text-[0.85rem] whitespace-pre-wrap break-words">
                        {message.body}
                      </p>
                    )}
                    <div className="mt-1 flex items-center justify-end gap-1.5">
                      <span
                        className={cn(
                          "text-[0.65rem] tabular-nums",
                          message.isMine ? "text-primary-foreground/65" : "text-muted-foreground"
                        )}
                      >
                        {formatTime(message.created_at)}
                      </span>
                      {message.isMine && !message.deleted_at && (
                        <RetractButton
                          messageId={message.id}
                          onDone={() => {
                            void queryClient.invalidateQueries({
                              queryKey: ["chat", "messages", conversation.id],
                            })
                            onChanged()
                          }}
                        />
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </ScrollArea>

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter breaks the line — the convention every chat uses.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                submit()
              }
            }}
            placeholder={`Mensagem como ${currentUserName}...`}
            rows={2}
            maxLength={4000}
            aria-label="Escrever mensagem"
            className="min-h-[2.75rem] resize-none"
          />
          <Button
            type="button"
            size="icon"
            aria-label="Enviar mensagem"
            disabled={isSending || !draft.trim()}
            onClick={submit}
          >
            <Send className="size-4" />
          </Button>
        </div>
        <p className="mt-1.5 text-[0.68rem] text-muted-foreground">
          Enter envia · Shift+Enter quebra linha. Esta conversa é interna da equipe e não é
          visível ao paciente.
        </p>
      </div>
    </div>
  )
}

function RetractButton({ messageId, onDone }: { messageId: string; onDone: () => void }) {
  const [isPending, start] = useTransition()

  return (
    <button
      type="button"
      aria-label="Apagar mensagem"
      disabled={isPending}
      className="opacity-0 transition-opacity group-hover/msg:opacity-70 hover:opacity-100 focus-visible:opacity-100"
      onClick={() =>
        start(async () => {
          try {
            await retractMessageAction(messageId)
            onDone()
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível apagar.")
          }
        })
      }
    >
      <Trash2 className="size-3" />
    </button>
  )
}
