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
import { updateProcedureAction, type ProcedureActionState } from "../actions/procedure.actions"
import { ProcedureFormFields } from "./procedure-form-fields"

type Procedure = Database["public"]["Tables"]["procedures"]["Row"]

const initialState: ProcedureActionState = {}

export function EditProcedureDialog({ procedure }: { procedure: Procedure }) {
  const [open, setOpen] = useState(false)
  const action = updateProcedureAction.bind(null, procedure.id)
  const [state, formAction, isPending] = useActionState(action, initialState)

  useCloseOnSuccess(state, Boolean(state.success), () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm">Editar</Button>} />
      <DialogContent className="max-w-lg">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Editar procedimento</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <ProcedureFormFields procedure={procedure} />
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
