"use client"

import { useActionState, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useCloseOnSuccess } from "@/hooks/use-close-on-success"
import type { Database } from "@/types/supabase"
import { updateMessageTemplateAction, type CommunicationActionState } from "../actions/communication.actions"
import { MessageTemplateFormFields } from "./message-template-form-fields"

type MessageTemplate = Database["public"]["Tables"]["message_templates"]["Row"]

const initialState: CommunicationActionState = {}

export function EditMessageTemplateDialog({ template }: { template: MessageTemplate }) {
  const [open, setOpen] = useState(false)
  const action = updateMessageTemplateAction.bind(null, template.id)
  const [state, formAction, isPending] = useActionState(action, initialState)

  useCloseOnSuccess(state, Boolean(state.success), () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm">Editar</Button>} />
      <DialogContent className="max-w-lg">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Editar modelo</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <MessageTemplateFormFields template={template} />
          </div>
          {state.error ? (
            <p className="mb-3 text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
