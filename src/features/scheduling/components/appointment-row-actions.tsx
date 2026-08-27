"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import type { AppointmentView } from "@/services/scheduling.service"
import type { ProcedureOption, ProfessionalOption } from "@/types/options"
import { AppointmentDetailDialog } from "./appointment-detail-dialog"

/**
 * The list row opens the same modal the calendar opens, rather than repeating confirm /
 * check-in / reschedule / cancel as inline buttons. One implementation means the two views
 * cannot disagree about what an action does — and the row stops being a cramped strip of
 * five buttons.
 */
export function AppointmentRowActions({
  appointment,
  professionals,
  procedures,
  rooms = [],
  canManage,
  canCheckIn,
}: {
  appointment: AppointmentView
  professionals: ProfessionalOption[]
  procedures: ProcedureOption[]
  rooms?: { id: string; name: string }[]
  canManage: boolean
  canCheckIn: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        aria-label={`Abrir agendamento de ${appointment.patientName}`}
      >
        Abrir
      </Button>
      <AppointmentDetailDialog
        appointment={appointment}
        professionals={professionals}
        procedures={procedures}
        rooms={rooms}
        canManage={canManage}
        canCheckIn={canCheckIn}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
