"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cancelAppointmentAction } from "../actions/appointment.actions"

export function CancelAppointmentDialog({ appointmentId }: { appointmentId: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [isPending, startTransition] = useTransition()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm">Cancelar</Button>} />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar agendamento</DialogTitle>
        </DialogHeader>
        <div className="grid gap-1.5 py-4">
          <Label htmlFor="reason">Motivo (opcional)</Label>
          <Textarea id="reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await cancelAppointmentAction(appointmentId, reason)
                setOpen(false)
              })
            }
          >
            {isPending ? "Cancelando..." : "Confirmar cancelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
