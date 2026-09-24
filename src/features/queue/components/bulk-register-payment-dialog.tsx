"use client"

import { useState, useTransition } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Wallet } from "lucide-react"

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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { registerPaymentAction } from "@/features/financial/actions/financial.actions"

type PaymentMethod = { id: string; name: string }

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

/**
 * Registra o mesmo método de pagamento para várias cobranças de uma vez — o caso comum
 * do balcão de manhã: uma fila de pacientes que pagaram PIX antes de entrar.
 *
 * Convênio fica de fora de propósito: emitir guia pede convênio e procedimento por
 * paciente, o que deixa de ser "a mesma ação repetida" e vira um formulário por pessoa —
 * exatamente o caso que `RegisterPaymentDialog` já cobre uma cobrança por vez.
 */
export function BulkRegisterPaymentDialog({
  entries,
  paymentMethods,
  onDone,
}: {
  entries: { transactionId: string; patientName: string; amount: number }[]
  paymentMethods: PaymentMethod[]
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [methodId, setMethodId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const queryClient = useQueryClient()

  const naoConvenio = paymentMethods.filter((m) => !m.name.toLowerCase().includes("conv"))
  const total = entries.reduce((sum, e) => sum + e.amount, 0)

  function submit() {
    if (!methodId) return
    startTransition(async () => {
      setError(null)
      for (const entry of entries) {
        const fd = new FormData()
        fd.set("payment_method_id", methodId)
        fd.set("amount", String(entry.amount))
        const result = await registerPaymentAction(entry.transactionId, {}, fd)
        if (result.error) {
          setError(`${entry.patientName}: ${result.error}`)
          queryClient.invalidateQueries({ queryKey: ["queue"] })
          return
        }
      }
      queryClient.invalidateQueries({ queryKey: ["queue"] })
      setOpen(false)
      setMethodId("")
      onDone()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" disabled={entries.length === 0}>
            <Wallet className="size-3.5" /> Registrar pagamento ({entries.length})
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagamento em lote</DialogTitle>
          <DialogDescription>
            {entries.length} {entries.length === 1 ? "cobrança" : "cobranças"} selecionadas ·
            total {formatCurrency(total)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Forma de pagamento</Label>
            <Select value={methodId} onValueChange={(v) => setMethodId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {naoConvenio.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[0.75rem] text-muted-foreground">
              Aplicada às {entries.length} cobranças selecionadas, cada uma pelo seu próprio
              valor. Convênio não entra no lote — precisa de guia por paciente.
            </p>
          </div>

          <ul className="grid max-h-40 gap-1 overflow-y-auto rounded-lg border border-border p-2 text-[0.8rem]">
            {entries.map((e) => (
              <li key={e.transactionId} className="flex justify-between gap-3">
                <span className="truncate">{e.patientName}</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatCurrency(e.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <p className="mb-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button disabled={!methodId || isPending} onClick={submit}>
            {isPending ? "Registrando..." : `Registrar ${entries.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
