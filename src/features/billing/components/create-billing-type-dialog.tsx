"use client"

import { useActionState, useState } from "react"
import { Plus } from "lucide-react"

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
import { createBillingTypeAction, type BillingActionState } from "../actions/billing.actions"
import { BillingTypeFormFields } from "./billing-type-form-fields"

const initialState: BillingActionState = {}

export function CreateBillingTypeDialog() {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(createBillingTypeAction, initialState)
  useCloseOnSuccess(state, Boolean(state.success), () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" aria-hidden />
            Novo tipo de cobrança
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        {/* key remonta o form após um sucesso, limpando os campos digitados. */}
        <form action={formAction} key={state.success ? "done" : "form"}>
          <DialogHeader>
            <DialogTitle>Novo tipo de cobrança</DialogTitle>
          </DialogHeader>
          <BillingTypeFormFields />
          {state.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
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
