"use client"

import { useActionState, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useCloseOnSuccess } from "@/hooks/use-close-on-success"
import { registerPaymentAction, type FinancialActionState } from "../actions/financial.actions"

type PaymentMethod = { id: string; name: string }

const initialState: FinancialActionState = {}

export function RegisterPaymentDialog({
  transactionId,
  amount,
  paymentMethods,
}: {
  transactionId: string
  amount: number
  paymentMethods: PaymentMethod[]
}) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const action = registerPaymentAction.bind(null, transactionId)
  const [state, formAction, isPending] = useActionState(action, initialState)

  useCloseOnSuccess(state, Boolean(state.success), () => {
    setOpen(false)
    // Settling a charge is what releases the patient — refresh the live queue board
    // immediately instead of waiting up to 5s for the next poll.
    queryClient.invalidateQueries({ queryKey: ["queue"] })
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Registrar pagamento</Button>} />
      <DialogContent className="max-w-md">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="payment_method_id">Forma de pagamento</Label>
              <Select name="payment_method_id" required>
                <SelectTrigger id="payment_method_id" className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((pm) => (
                    <SelectItem key={pm.id} value={pm.id}>
                      {pm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input id="amount" name="amount" type="number" min={0.01} step="0.01" defaultValue={amount} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="notes">Observações</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>
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
              {isPending ? "Registrando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
