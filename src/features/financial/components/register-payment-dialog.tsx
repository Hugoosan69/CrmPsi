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
import { InsurerGuideFields } from "@/features/billing/components/insurer-guide-fields"
import {
  registerInsurerGuideAction,
  type GuideActionState,
} from "@/features/billing/actions/guide.actions"
import { registerPaymentAction, type FinancialActionState } from "../actions/financial.actions"
import { useDialogOpen, type DialogOpenProps } from "@/hooks/use-dialog-open"

type PaymentMethod = { id: string; name: string }

const initialState: FinancialActionState = {}

export function RegisterPaymentDialog({
  transactionId,
  amount,
  paymentMethods,
  insurers = [],
  ...dialogProps
}: {
  transactionId: string
  amount: number
  paymentMethods: PaymentMethod[]
  /** Convênios ativos. Vazio quando não há nenhum — a tela avisa em vez de sumir. */
  insurers?: { id: string; name: string; amount_per_guide: number }[]
} & DialogOpenProps) {
  const [open, setOpen] = useDialogOpen(dialogProps)
  const queryClient = useQueryClient()
  // Duas ações, porque são dois fatos diferentes: o pagamento comum registra um
  // recebimento; o convênio EMITE UMA GUIA e reescreve quanto sobra para o paciente.
  const [metodo, setMetodo] = useState<string>("")
  const metodoEscolhido = paymentMethods.find((m) => m.id === metodo)
  const ehConvenio = (metodoEscolhido?.name ?? "").toLowerCase().includes("conv")

  const [state, formAction, isPending] = useActionState(
    registerPaymentAction.bind(null, transactionId),
    initialState
  )
  const [guideState, guideAction, isGuidePending] = useActionState<GuideActionState, FormData>(
    registerInsurerGuideAction.bind(null, transactionId),
    {}
  )
  const estadoAtivo = ehConvenio ? guideState : state
  const pendente = ehConvenio ? isGuidePending : isPending

  useCloseOnSuccess(estadoAtivo, Boolean(estadoAtivo.success), () => {
    setOpen(false)
    // Settling a charge is what releases the patient — refresh the live queue board
    // immediately instead of waiting up to 5s for the next poll.
    queryClient.invalidateQueries({ queryKey: ["queue"] })
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!dialogProps.hideTrigger && (
      <DialogTrigger render={<Button size="sm">Registrar pagamento</Button>} />
      )}
      <DialogContent className="max-w-md">
        <form action={ehConvenio ? guideAction : formAction}>
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="payment_method_id">Forma de pagamento</Label>
              <Select
                name={ehConvenio ? undefined : "payment_method_id"}
                value={metodo}
                onValueChange={(v) => setMetodo(v ?? "")}
                required
              >
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
            {ehConvenio ? (
              <InsurerGuideFields
                insurers={insurers}
                paymentMethods={paymentMethods.filter(
                  (m) => !m.name.toLowerCase().includes("conv")
                )}
                procedureAmount={amount}
              />
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor="amount">Valor (R$)</Label>
                <Input id="amount" name="amount" type="number" min={0.01} step="0.01" defaultValue={amount} required />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="notes">Observações</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>
          </div>
          {estadoAtivo.error ? (
            <p className="mb-3 text-sm text-destructive" role="alert">
              {estadoAtivo.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pendente}>
              {pendente ? "Registrando..." : ehConvenio ? "Registrar guia" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
