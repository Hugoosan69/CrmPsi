"use client"

import { useActionState, useState, useTransition } from "react"
import { MessageSquarePlus, Users } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  createGroupConversationAction,
  openDirectConversationAction,
  type ChatActionState,
} from "../actions/internal-chat.actions"

type Contact = { id: string; fullName: string; email: string; roleName: string | null }

const initialState: ChatActionState = {}

export function NewConversationDialog({
  contacts,
  onOpened,
}: {
  contacts: Contact[]
  onOpened: (conversationId: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="w-full">
            <MessageSquarePlus className="size-4" />
            Nova conversa
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
        </DialogHeader>

        {contacts.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Não há outros membros ativos na clínica para conversar.
          </p>
        ) : (
          <Tabs defaultValue="direta">
            <TabsList>
              <TabsTrigger value="direta">Direta</TabsTrigger>
              <TabsTrigger value="grupo">Grupo</TabsTrigger>
            </TabsList>

            <TabsContent value="direta" className="mt-4">
              <DirectPicker
                contacts={contacts}
                onOpened={(id) => {
                  setOpen(false)
                  onOpened(id)
                }}
              />
            </TabsContent>

            <TabsContent value="grupo" className="mt-4">
              <GroupForm
                contacts={contacts}
                onCreated={(id) => {
                  setOpen(false)
                  onOpened(id)
                }}
              />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DirectPicker({
  contacts,
  onOpened,
}: {
  contacts: Contact[]
  onOpened: (conversationId: string) => void
}) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, start] = useTransition()

  return (
    <ScrollArea className="max-h-72">
      <ul className="grid gap-1">
        {contacts.map((contact) => (
          <li key={contact.id}>
            <button
              type="button"
              disabled={pendingId !== null}
              className="flex w-full items-baseline justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent/60 disabled:opacity-60"
              onClick={() => {
                setPendingId(contact.id)
                start(async () => {
                  const result = await openDirectConversationAction(contact.id)
                  setPendingId(null)
                  if (result.error) {
                    toast.error(result.error)
                    return
                  }
                  if (result.conversationId) onOpened(result.conversationId)
                })
              }}
            >
              <span className="min-w-0">
                <span className="block truncate text-[0.85rem] font-medium">
                  {contact.fullName}
                </span>
                <span className="block truncate text-[0.72rem] text-muted-foreground">
                  {contact.roleName ?? contact.email}
                </span>
              </span>
              {pendingId === contact.id && (
                <span className="shrink-0 text-[0.72rem] text-muted-foreground">abrindo...</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </ScrollArea>
  )
}

function GroupForm({
  contacts,
  onCreated,
}: {
  contacts: Contact[]
  onCreated: (conversationId: string) => void
}) {
  const [state, formAction, isPending] = useActionState(createGroupConversationAction, initialState)
  const [lastState, setLastState] = useState<ChatActionState>(state)

  // Same render-time comparison pattern as useCloseOnSuccess: useActionState hands back a
  // new object identity per resolution, so identity is the signal.
  if (lastState !== state) {
    setLastState(state)
    if (state.success && state.conversationId) onCreated(state.conversationId)
  }

  return (
    <form action={formAction} className="grid gap-3.5">
      <div className="grid gap-1.5">
        <Label htmlFor="group-title">Nome do grupo</Label>
        <Input id="group-title" name="title" placeholder="Recepção, Plantão, Diretoria..." required />
      </div>

      <fieldset className="grid gap-1.5">
        <legend className="mb-1 flex items-center gap-1.5 text-sm font-medium">
          <Users className="size-3.5 text-muted-foreground" aria-hidden />
          Participantes
        </legend>
        <ScrollArea className="max-h-52 rounded-lg border border-border p-1">
          <ul className="grid gap-0.5">
            {contacts.map((contact) => (
              <li key={contact.id}>
                <label className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent/50">
                  <Checkbox name="participants" value={contact.id} />
                  <span className="min-w-0">
                    <span className="block truncate text-[0.82rem]">{contact.fullName}</span>
                    <span className="block truncate text-[0.7rem] text-muted-foreground">
                      {contact.roleName ?? contact.email}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </fieldset>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Criando..." : "Criar grupo"}
        </Button>
      </DialogFooter>
    </form>
  )
}
