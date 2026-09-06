"use client"

import { useActionState } from "react"

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
import { updateProfessionalAction, type ProfessionalActionState } from "../actions/professional.actions"
import { ProfessionalFormFields } from "./professional-form-fields"
import { useDialogOpen, type DialogOpenProps } from "@/hooks/use-dialog-open"

type Professional = Database["public"]["Tables"]["professionals"]["Row"]
type Specialty = Pick<Database["public"]["Tables"]["specialties"]["Row"], "id" | "name">

const initialState: ProfessionalActionState = {}

export function EditProfessionalDialog({
  professional,
  specialties,
  ...dialogProps
}: {
  professional: Professional
  specialties: Specialty[]
} & DialogOpenProps) {
  const [open, setOpen] = useDialogOpen(dialogProps)
  const action = updateProfessionalAction.bind(null, professional.id)
  const [state, formAction, isPending] = useActionState(action, initialState)

  useCloseOnSuccess(state, Boolean(state.success), () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!dialogProps.hideTrigger && (
      <DialogTrigger render={<Button variant="ghost" size="sm">Editar</Button>} />
      )}
      <DialogContent className="max-w-lg">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Editar profissional</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <ProfessionalFormFields professional={professional} specialties={specialties} />
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
