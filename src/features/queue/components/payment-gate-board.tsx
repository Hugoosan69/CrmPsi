"use client"

import { useState, useTransition } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowRight, Lock, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { RegisterPaymentDialog } from "@/features/financial/components/register-payment-dialog"
import { StatusDot } from "@/components/shared/status-dot"
import { cn } from "@/lib/utils"
import { formatTime } from "@/utils/datetime"
import type { QueueEntryView } from "@/services/queue.service"
import { releaseToQueueAction } from "../actions/queue.actions"
import { BulkRegisterPaymentDialog } from "./bulk-register-payment-dialog"

type PaymentMethod = { id: string; name: string }
import type { InsurerOption } from "@/features/billing/components/insurer-guide-fields"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

/** A partir daqui um paciente já pago e ainda não enviado deixa de ser normal e vira atraso. */
const SEND_OVERDUE_MINUTES = 10

function SectionHeader({
  title,
  count,
  tone,
  hint,
  children,
}: {
  title: string
  count: number
  tone: "danger" | "success"
  hint: string
  children?: React.ReactNode
}) {
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="font-heading text-[0.95rem] font-semibold">{title}</h2>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[0.7rem] font-semibold tabular-nums",
            tone === "danger"
              ? "bg-status-danger/12 text-status-danger"
              : "bg-status-success/12 text-status-success"
          )}
        >
          {count}
        </span>
        {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
      </div>
      <p className="text-[0.78rem] text-muted-foreground">{hint}</p>
    </div>
  )
}

function GateRow({
  children,
  accent,
  selected,
  onToggle,
}: {
  children: React.ReactNode
  accent?: "overdue"
  selected?: boolean
  onToggle?: (checked: boolean) => void
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-3 rounded-xl border bg-card p-4 shadow-soft",
        accent === "overdue" ? "border-status-warning/45" : "border-border"
      )}
    >
      {onToggle && (
        <Checkbox
          checked={selected ?? false}
          onCheckedChange={(v) => onToggle(v === true)}
          aria-label="Selecionar"
        />
      )}
      <div className="min-w-0 flex-1 basis-48">{children}</div>
    </div>
  )
}

/**
 * Um bloco por situação, com fundo e borda próprios — não só um título separando texto
 * corrido. É a diferença entre "três listas" e "uma lista comprida com subtítulos", e é
 * a leitura rápida que o balcão precisa entre um paciente e outro.
 */
function SectionCard({
  tone,
  children,
}: {
  tone: "danger" | "success"
  children: React.ReactNode
}) {
  return (
    <section
      className={cn(
        "grid gap-3 rounded-xl border p-4",
        tone === "danger"
          ? "border-status-danger/25 bg-status-danger/[0.03]"
          : "border-status-success/25 bg-status-success/[0.03]"
      )}
    >
      {children}
    </section>
  )
}

/**
 * O balcão tem DUAS filas antes da fila, e elas não são a mesma coisa:
 *
 *  `payment_pending` — chegou, cobrança em aberto, não pode ser chamado.
 *  `released`        — JÁ PAGOU e está esperando o clique "Enviar para fila".
 *
 * Cada uma vive num bloco próprio (fundo e borda coloridos, não só um título), e cada uma
 * aceita seleção múltipla para a ação em lote correspondente — enviar vários para a fila
 * de uma vez, ou registrar o mesmo método de pagamento para várias cobranças.
 */
export function PaymentGateBoard({
  entries,
  paymentMethods,
  insurers = [],
}: {
  entries: QueueEntryView[]
  paymentMethods: PaymentMethod[]
  insurers?: InsurerOption[]
}) {
  const queryClient = useQueryClient()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [selectedSend, setSelectedSend] = useState<Set<string>>(new Set())
  const [selectedPay, setSelectedPay] = useState<Set<string>>(new Set())

  const awaitingPayment = entries.filter((e) => e.status === "payment_pending")
  const readyToSend = entries.filter((e) => e.status === "released")
  const payableSelection = awaitingPayment.filter((e) => selectedPay.has(e.id) && e.charge)

  if (entries.length === 0) return null

  function send(id: string) {
    startTransition(async () => {
      setError(null)
      const result = await releaseToQueueAction(id)
      if (result.error) setError(result.error)
      queryClient.invalidateQueries({ queryKey: ["queue"] })
    })
  }

  function sendSelected() {
    startTransition(async () => {
      setError(null)
      for (const id of selectedSend) {
        const result = await releaseToQueueAction(id)
        if (result.error) {
          setError(result.error)
          break
        }
      }
      queryClient.invalidateQueries({ queryKey: ["queue"] })
      setSelectedSend(new Set())
    })
  }

  function toggleSend(id: string, checked: boolean) {
    setSelectedSend((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function togglePay(id: string, checked: boolean) {
    setSelectedPay((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  return (
    <div className="grid gap-5">
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* ---- Pagos, esperando envio. Vem PRIMEIRO: é o único bloco com paciente parado
              por inação da recepção, e é a ação mais barata do balcão. ---- */}
      {readyToSend.length > 0 && (
        <SectionCard tone="success">
          <SectionHeader
            title="Pagos — enviar para a fila"
            count={readyToSend.length}
            tone="success"
            hint="Pagamento confirmado. Enquanto não forem enviados, nenhum profissional enxerga estes pacientes."
          >
            {selectedSend.size > 0 && (
              <Button size="sm" disabled={isPending} onClick={sendSelected}>
                Enviar {selectedSend.size} para a fila <ArrowRight className="size-3.5" />
              </Button>
            )}
          </SectionHeader>
          <div className="grid gap-2.5">
            {readyToSend.map((entry) => {
              const overdue = entry.waitingMinutes >= SEND_OVERDUE_MINUTES
              return (
                <GateRow
                  key={entry.id}
                  accent={overdue ? "overdue" : undefined}
                  selected={selectedSend.has(entry.id)}
                  onToggle={(checked) => toggleSend(entry.id, checked)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{entry.patientName}</p>
                        <StatusDot tone="success" label="Pagamento confirmado" />
                      </div>
                      <p className="mt-0.5 truncate text-[0.8rem] text-muted-foreground">
                        {entry.professionalName ?? "Sem profissional definido"} · chegou às{" "}
                        {formatTime(entry.arrived_at)}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <span
                        className={cn(
                          "text-[0.8rem] tabular-nums",
                          overdue ? "font-semibold text-status-warning" : "text-muted-foreground"
                        )}
                      >
                        {overdue ? "parado há " : "há "}
                        {entry.waitingMinutes} min
                      </span>
                      <Button disabled={isPending} onClick={() => send(entry.id)}>
                        Enviar para fila <ArrowRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                </GateRow>
              )
            })}
          </div>
        </SectionCard>
      )}

      {/* ---- Cobrança em aberto ---- */}
      {awaitingPayment.length > 0 && (
        <SectionCard tone="danger">
          <SectionHeader
            title="Aguardando pagamento"
            count={awaitingPayment.length}
            tone="danger"
            hint="Chegaram e têm cobrança em aberto. O banco impede a entrada na fila até o pagamento ser confirmado."
          >
            {payableSelection.length > 0 && (
              <BulkRegisterPaymentDialog
                entries={payableSelection.map((e) => ({
                  transactionId: e.charge!.id,
                  patientName: e.patientName,
                  amount: e.charge!.amount,
                }))}
                paymentMethods={paymentMethods}
                onDone={() => setSelectedPay(new Set())}
              />
            )}
          </SectionHeader>
          <div className="grid gap-2.5">
            {awaitingPayment.map((entry) => (
              <GateRow
                key={entry.id}
                selected={selectedPay.has(entry.id)}
                onToggle={entry.charge ? (checked) => togglePay(entry.id, checked) : undefined}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{entry.patientName}</p>
                      <StatusDot tone="danger" label="Pagamento pendente" />
                    </div>
                    <p className="mt-0.5 truncate text-[0.8rem] text-muted-foreground">
                      {entry.charge?.description ?? "Atendimento"}
                      {entry.professionalName ? ` · ${entry.professionalName}` : ""} · chegou às{" "}
                      {formatTime(entry.arrived_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    {entry.charge && (
                      <p className="metric text-lg font-semibold tabular-nums">
                        {formatCurrency(entry.charge.amount)}
                      </p>
                    )}
                    {entry.charge ? (
                      <RegisterPaymentDialog
                        transactionId={entry.charge.id}
                        amount={entry.charge.amount}
                        paymentMethods={paymentMethods}
                        insurers={insurers}
                        procedureId={entry.procedureId}
                      />
                    ) : (
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Lock className="size-3.5" aria-hidden /> Sem cobrança vinculada
                      </span>
                    )}
                  </div>
                </div>
              </GateRow>
            ))}
          </div>
        </SectionCard>
      )}

      {readyToSend.length === 0 && awaitingPayment.length > 0 && (
        <p className="flex items-center gap-1.5 text-[0.75rem] text-muted-foreground">
          <Wallet className="size-3.5" aria-hidden />
          Confirmado o pagamento, o paciente aparece acima para ser enviado à fila.
        </p>
      )}
    </div>
  )
}
