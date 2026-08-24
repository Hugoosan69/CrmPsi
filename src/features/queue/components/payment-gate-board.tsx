"use client"

import { useState, useTransition } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowRight, Lock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { RegisterPaymentDialog } from "@/features/financial/components/register-payment-dialog"
import { StatusDot } from "@/components/shared/status-dot"
import type { QueueEntryView } from "@/services/queue.service"
import { releaseToQueueAction } from "../actions/queue.actions"

type PaymentMethod = { id: string; name: string }

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

/**
 * The reception-side gate (CSIB rule): patients who have arrived but whose payment is
 * not settled sit here, visibly blocked, with the charge amount and the one action that
 * unblocks them. Nothing in this band is callable by a professional.
 */
export function PaymentGateBoard({
  entries,
  paymentMethods,
}: {
  entries: QueueEntryView[]
  paymentMethods: PaymentMethod[]
}) {
  const queryClient = useQueryClient()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (entries.length === 0) return null

  return (
    <section className="grid gap-3">
      <div className="flex items-center gap-2.5">
        <h2 className="font-heading text-[0.95rem] font-semibold">Aguardando pagamento</h2>
        <span className="rounded-full bg-status-danger/12 px-2 py-0.5 text-[0.7rem] font-semibold text-status-danger tabular-nums">
          {entries.length}
        </span>
        <span className="h-px flex-1 bg-border" aria-hidden />
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-2.5">
        {entries.map((entry) => {
          const paid = entry.status === "released"
          return (
            <div
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-soft"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{entry.patientName}</p>
                  <StatusDot
                    tone={paid ? "success" : "danger"}
                    label={paid ? "Pagamento confirmado" : "Pagamento pendente"}
                  />
                </div>
                <p className="mt-0.5 truncate text-[0.8rem] text-muted-foreground">
                  {entry.charge?.description ?? "Atendimento"}
                  {entry.professionalName ? ` · ${entry.professionalName}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-4">
                {entry.charge && (
                  <p className="metric text-lg font-semibold">{formatCurrency(entry.charge.amount)}</p>
                )}

                {paid ? (
                  <Button
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        setError(null)
                        const result = await releaseToQueueAction(entry.id)
                        if (result.error) setError(result.error)
                        queryClient.invalidateQueries({ queryKey: ["queue"] })
                      })
                    }
                  >
                    Enviar para fila <ArrowRight className="size-4" />
                  </Button>
                ) : entry.charge ? (
                  <RegisterPaymentDialog
                    transactionId={entry.charge.id}
                    amount={entry.charge.amount}
                    paymentMethods={paymentMethods}
                  />
                ) : (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Lock className="size-3.5" /> Sem cobrança vinculada
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
