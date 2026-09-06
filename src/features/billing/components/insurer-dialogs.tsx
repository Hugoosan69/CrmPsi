"use client"

import { useActionState, useState } from "react"
import { Pencil, Plus } from "lucide-react"

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
import { useDialogOpen, type DialogOpenProps } from "@/hooks/use-dialog-open"
import type { Insurer } from "@/services/billing.service"
import {
  createInsurerAction,
  updateInsurerAction,
  type BillingActionState,
} from "../actions/billing.actions"
import { InsurerFormFields } from "./insurer-form-fields"

const initialState: BillingActionState = {}

export function CreateInsurerDialog() {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(createInsurerAction, initialState)
  useCloseOnSuccess(state, Boolean(state.success), () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" aria-hidden />
            Novo convênio
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        {/* key remonta o form após um sucesso, limpando os campos digitados. */}
        <form action={formAction} key={state.success ? "done" : "form"}>
          <DialogHeader>
            <DialogTitle>Novo convênio</DialogTitle>
          </DialogHeader>
          <InsurerFormFields />
          {state.error && (
            <p
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {state.error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EditInsurerDialog({
  insurer,
  ...dialogProps
}: { insurer: Insurer } & DialogOpenProps) {
  const [open, setOpen] = useDialogOpen(dialogProps)
  const [state, formAction, isPending] = useActionState(
    updateInsurerAction.bind(null, insurer.id),
    initialState
  )
  useCloseOnSuccess(state, Boolean(state.success), () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!dialogProps.hideTrigger && (
        <DialogTrigger
          render={
            <Button variant="ghost" size="sm">
              <Pencil className="size-3.5" aria-hidden />
              Editar
            </Button>
          }
        />
      )}
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Editar {insurer.name}</DialogTitle>
          </DialogHeader>
          <InsurerFormFields insurer={insurer} />
          {state.error && (
            <p
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {state.error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
