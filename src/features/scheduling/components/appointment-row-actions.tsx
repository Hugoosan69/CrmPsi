"use client"

import { useTransition } from "react"

import { Button } from "@/components/ui/button"
import type { AppointmentView } from "@/services/scheduling.service"
import {
  confirmAppointmentAction,
  markNoShowAppointmentAction,
} from "../actions/appointment.actions"
import { CancelAppointmentDialog } from "./cancel-appointment-dialog"
import { CheckInDialog } from "./check-in-dialog"
import { RescheduleAppointmentDialog } from "./reschedule-appointment-dialog"
import type { ProcedureOption, ProfessionalOption } from "@/types/options"

export function AppointmentRowActions({
  appointment,
  professionals,
  procedures,
  canManage,
  canCheckIn,
}: {
  appointment: AppointmentView
  professionals: ProfessionalOption[]
  procedures: ProcedureOption[]
  canManage: boolean
  canCheckIn: boolean
}) {
  const [isPending, startTransition] = useTransition()

  if (appointment.status === "cancelled" || appointment.status === "completed") {
    return null
  }

  return (
    <div className="flex flex-wrap justify-end gap-1">
      {canManage && appointment.status === "scheduled" && (
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => startTransition(() => confirmAppointmentAction(appointment.id))}
        >
          Confirmar
        </Button>
      )}
      {canCheckIn &&
        !appointment.checked_in_at &&
        (appointment.status === "scheduled" || appointment.status === "confirmed") && (
          <CheckInDialog
            appointment={appointment}
            procedurePrice={
              appointment.procedure_id
                ? procedures.find((p) => p.id === appointment.procedure_id)?.price ?? null
                : null
            }
          />
        )}
      {canManage && (
        <>
          <RescheduleAppointmentDialog
            appointment={appointment}
            professionals={professionals}
            procedures={procedures}
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => startTransition(() => markNoShowAppointmentAction(appointment.id))}
          >
            Não compareceu
          </Button>
          <CancelAppointmentDialog appointmentId={appointment.id} />
        </>
      )}
    </div>
  )
}
