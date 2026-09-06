"use client"

import { useActionState } from "react"
import { Pencil } from "lucide-react"

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
import type { BillingType } from "@/services/billing.service"
import { updateBillingTypeAction, type BillingActionState } from "../actions/billing.actions"
import { BillingTypeFormFields } from "./billing-type-form-fields"

const initialState: BillingActionState = {}

export function EditBillingTypeDialog({
  billingType,
  ...dialogProps
}: { billingType: BillingType } & DialogOpenProps) {
  const [open, setOpen] = useDialogOpen(dialogProps)
  const [state, formAction, isPending] = useActionState(
    updateBillingTypeAction.bind(null, billingType.id),
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
            <DialogTitle>Editar {billingType.name}</DialogTitle>
          </DialogHeader>
          <BillingTypeFormFields billingType={billingType} />
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
