"use client"

import { useActionState, useState } from "react"
import { LogIn } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCloseOnSuccess } from "@/hooks/use-close-on-success"
import type { AppointmentView } from "@/services/scheduling.service"
import { checkInAppointmentAction, type CheckInState } from "../actions/appointment.actions"

const initialState: CheckInState = {}

/**
 * Check-in is where the charge is opened — the CSIB rule is payment before queue, so
 * this dialog makes the amount explicit at arrival instead of hiding it until later.
 * The patient lands as "Pagamento pendente" and is NOT in the queue yet.
 */
export function CheckInDialog({
  appointment,
  procedurePrice,
}: {
  appointment: AppointmentView
  procedurePrice: number | null
}) {
  const [open, setOpen] = useState(false)
  const action = checkInAppointmentAction.bind(null, appointment.id)
  const [state, formAction, isPending] = useActionState(action, initialState)

  useCloseOnSuccess(state, Boolean(state.success), () => setOpen(false))

  const hasPrice = procedurePrice !== null && procedurePrice > 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <LogIn className="size-3.5" /> Check-in
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Check-in e cobrança</DialogTitle>
            <DialogDescription>
              O paciente entra como <strong>pagamento pendente</strong> e só vai para a fila após o
              pagamento ser confirmado.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 text-sm">
            <div className="grid gap-2 rounded-lg border border-border bg-muted/40 p-3">
              <Row label="Paciente" value={appointment.patientName} />
              <Row label="Profissional" value={appointment.professionalName} />
              <Row label="Procedimento" value={appointment.procedureName ?? "Não informado"} />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="amount">Valor a cobrar (R$)</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                min={0.01}
                step="0.01"
                defaultValue={hasPrice ? procedurePrice : undefined}
                required={!hasPrice}
                placeholder={hasPrice ? undefined : "Informe o valor"}
              />
              <p className="text-xs text-muted-foreground">
                {hasPrice
                  ? "Preço do procedimento. Ajuste se necessário."
                  : "Este procedimento não tem preço cadastrado — informe o valor."}
              </p>
            </div>
          </div>

          {state.error ? (
            <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Registrando..." : "Confirmar check-in"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}
