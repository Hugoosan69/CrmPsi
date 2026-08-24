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
import type { AppointmentView } from "@/services/scheduling.service"
import { rescheduleAppointmentAction, type AppointmentActionState } from "../actions/appointment.actions"
import { AppointmentFormFields } from "./appointment-form-fields"
import type { ProcedureOption, ProfessionalOption } from "@/types/options"

const initialState: AppointmentActionState = {}

export function RescheduleAppointmentDialog({
  appointment,
  professionals,
  procedures,
}: {
  appointment: AppointmentView
  professionals: ProfessionalOption[]
  procedures: ProcedureOption[]
}) {
  const [open, setOpen] = useState(false)
  const action = rescheduleAppointmentAction.bind(null, appointment.id)
  const [state, formAction, isPending] = useActionState(action, initialState)

  useCloseOnSuccess(state, Boolean(state.success), () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm">Reagendar</Button>} />
      <DialogContent className="max-w-lg">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Reagendar</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <AppointmentFormFields
              appointment={appointment}
              patientDefault={{ id: appointment.patient_id, label: appointment.patientName }}
              professionals={professionals}
              procedures={procedures}
            />
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
