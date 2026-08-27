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
import { createAppointmentAction, type AppointmentActionState } from "../actions/appointment.actions"
import { AppointmentFormFields } from "./appointment-form-fields"
import type { ProcedureOption, ProfessionalOption } from "@/types/options"

const initialState: AppointmentActionState = {}

export function CreateAppointmentDialog({
  professionals,
  procedures,
  rooms = [],
}: {
  professionals: ProfessionalOption[]
  procedures: ProcedureOption[]
  rooms?: { id: string; name: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(createAppointmentAction, initialState)

  useCloseOnSuccess(state, Boolean(state.success), () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Novo agendamento</Button>} />
      <DialogContent className="max-w-lg">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Novo agendamento</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <AppointmentFormFields professionals={professionals} procedures={procedures} rooms={rooms} />
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
              {isPending ? "Salvando..." : "Agendar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
