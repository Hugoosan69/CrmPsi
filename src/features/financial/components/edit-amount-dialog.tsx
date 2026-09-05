"use client"

import { useActionState, useState } from "react"
import { AlertTriangle, ShieldAlert } from "lucide-react"

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
import { Textarea } from "@/components/ui/textarea"
import { useCloseOnSuccess } from "@/hooks/use-close-on-success"
import { updateTransactionAmountAction, type FinancialActionState } from "../actions/financial.actions"

const initialState: FinancialActionState = {}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

/**
 * Correção do valor de um lançamento.
 *
 * O aviso de auditoria não é decoração: mexer no valor de algo já contabilizado é o tipo
 * de edição que alguém vai querer explicar depois. Quem edita vê, antes de confirmar, que
 * ficam registrados o valor anterior, o novo, quem mudou e quando.
 *
 * `isPaid` acrescenta o segundo aviso, e não é o mesmo caso: corrigir uma cobrança em
 * aberto ajusta o que ainda vai entrar; mudar uma linha paga mexe em dinheiro que já
 * entrou, já foi conciliado e já contou no fechamento. Por isso essa edição exige, além de
 * `financial.edit_amount`, a permissão `financial.edit_paid` (migrations/020) — conferida
 * de novo na Server Action.
 */
export function EditAmountDialog({
  transactionId,
  amount,
  description,
  isPaid = false,
}: {
  transactionId: string
  amount: number
  description: string | null
  isPaid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const action = updateTransactionAmountAction.bind(null, transactionId)
  const [state, formAction, isPending] = useActionState(action, initialState)

  useCloseOnSuccess(state, Boolean(state.success), () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm">Corrigir valor</Button>} />
      <DialogContent className="max-w-md">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Corrigir valor</DialogTitle>
            <DialogDescription>
              {description || "Lançamento"} — valor atual {formatCurrency(amount)}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {isPaid && (
              <div className="flex gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  Este lançamento <strong className="font-medium text-foreground">já está
                  pago</strong>. Alterar o valor muda dinheiro que já entrou no caixa e já
                  contou no fechamento do período — só faça se a conciliação for refeita.
                </p>
              </div>
            )}

            <div className="flex gap-2.5 rounded-lg border border-status-warning/40 bg-status-warning/5 p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-warning" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Esta alteração fica <strong className="font-medium text-foreground">registrada
                na auditoria</strong>: valor anterior, valor novo, quem alterou e quando.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="amount">Novo valor (R$)</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                min={0}
                step="0.01"
                defaultValue={amount}
                required
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="reason">Motivo da correção</Label>
              <Textarea id="reason" name="reason" rows={2} placeholder="Ex.: valor digitado errado" />
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
            <Button type="submit" variant={isPaid ? "destructive" : "default"} disabled={isPending}>
              {isPending ? "Salvando..." : "Confirmar correção"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
