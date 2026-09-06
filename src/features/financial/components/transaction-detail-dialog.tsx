"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { CalendarDays, CreditCard, Info, Layers, Receipt, User } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusDot } from "@/components/shared/status-dot"
import { cn } from "@/lib/utils"
import type { TransactionDetail } from "@/services/financial-detail.service"
import { getTransactionDetailAction } from "../actions/transaction-detail.actions"
import { TransactionStatusBadge } from "./transaction-status-badge"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
}

function formatDate(value: string | null) {
  if (!value) return "—"
  // `date` puro não passa por `Date`: seria lido como UTC e mostraria o dia anterior.
  const [year, month, day] = value.split("-")
  return day ? `${day}/${month}/${year}` : value
}

const APPOINTMENT_STATUS: Record<string, string> = {
  scheduled: "Agendado",
  triagem: "Triagem",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Falta",
}

const SESSION_STATUS: Record<string, string> = {
  reserved: "Reservada",
  consumed: "Consumida",
  released: "Liberada",
}

const BILLING_MODE: Record<string, string> = {
  unico: "Valor total na venda",
  por_sessao: "Dividido por sessão",
}

/** Bloco com título e ícone — a mesma moldura para cada assunto do lançamento. */
function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Info
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-2">
      <h3 className="flex items-center gap-1.5 text-[0.7rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        <Icon className="size-3.5" aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  )
}

/** Par rótulo/valor. Em telas estreitas empilha em vez de espremer. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-[0.8rem] text-muted-foreground">{label}</span>
      <span className="text-[0.85rem] font-medium">{children}</span>
    </div>
  )
}

function DetailBody({ detail }: { detail: TransactionDetail }) {
  const pago = detail.payments.reduce((sum, p) => sum + p.amount, 0)
  const session = detail.packageSession
  // Em pacote a divergência é o que explica o "R$ 0,00, por quê?" — e denuncia o
  // lançamento que ficou fora do modo de cobrança atual.
  const divergente = session && session.expectedAmount !== detail.amount

  return (
    <div className="grid gap-5">
      <Section icon={Receipt} title="Lançamento">
        <div className="grid">
          <Row label="Valor">
            <span className={cn("metric tabular-nums", detail.type === "despesa" && "text-destructive")}>
              {detail.type === "despesa" ? "− " : ""}
              {formatCurrency(detail.amount)}
            </span>
          </Row>
          <Row label="Situação">
            <TransactionStatusBadge status={detail.status} />
          </Row>
          <Row label="Tipo">{detail.type === "receita" ? "Receita" : "Despesa"}</Row>
          {detail.category && <Row label="Categoria">{detail.category}</Row>}
          <Row label="Vencimento">{formatDate(detail.dueDate)}</Row>
          <Row label="Lançado em">{formatDateTime(detail.createdAt)}</Row>
          {detail.createdByName && <Row label="Lançado por">{detail.createdByName}</Row>}
        </div>
      </Section>

      {detail.patient && (
        <Section icon={User} title="Paciente">
          <div className="grid">
            <Row label="Nome">
              <Link
                href={`/recepcao/pacientes/${detail.patient.id}`}
                className="text-primary underline-offset-2 hover:underline"
              >
                {detail.patient.name}
              </Link>
            </Row>
          </div>
        </Section>
      )}

      {detail.appointment && (
        <Section icon={CalendarDays} title="Atendimento">
          <div className="grid">
            <Row label="Data">{formatDateTime(detail.appointment.scheduledAt)}</Row>
            <Row label="Duração">{detail.appointment.durationMinutes} min</Row>
            {detail.appointment.professionalName && (
              <Row label="Profissional">{detail.appointment.professionalName}</Row>
            )}
            {detail.appointment.procedureName && (
              <Row label="Procedimento">{detail.appointment.procedureName}</Row>
            )}
            <Row label="Situação">
              {APPOINTMENT_STATUS[detail.appointment.status] ?? detail.appointment.status}
            </Row>
          </div>
        </Section>
      )}

      {session && (
        <Section icon={Layers} title="Sessão de pacote">
          <div className="grid">
            <Row label="Pacote">{session.packageName}</Row>
            {session.specialtyName && <Row label="Especialidade">{session.specialtyName}</Row>}
            <Row label="Sessão">
              <span className="tabular-nums">
                {session.sessionNumber} de {session.totalSessions}
              </span>
            </Row>
            <Row label="Saldo usado">
              <span className="tabular-nums">
                {session.sessionsUsed} de {session.totalSessions} ·{" "}
                {Math.max(0, session.totalSessions - session.sessionsUsed)} restante(s)
              </span>
            </Row>
            <Row label="Situação da sessão">
              {SESSION_STATUS[session.sessionStatus] ?? session.sessionStatus}
            </Row>
            <Row label="Cobrança do pacote">
              {BILLING_MODE[session.billingMode] ?? session.billingMode}
            </Row>
            <Row label="Valor esperado">
              <span className="tabular-nums">{formatCurrency(session.expectedAmount)}</span>
            </Row>
          </div>

          {divergente ? (
            <p className="rounded-lg border border-status-warning/40 bg-status-warning/[0.06] px-3 py-2 text-[0.8rem]">
              <StatusDot tone="warning" label="Fora do modo de cobrança" />{" "}
              O lançamento está em {formatCurrency(detail.amount)} e este pacote manda{" "}
              {formatCurrency(session.expectedAmount)}. Use “Reprocessar saldos e financeiro”
              no catálogo de pacotes para alinhar.
            </p>
          ) : (
            session.billingMode === "unico" && (
              <p className="text-[0.78rem] text-muted-foreground">
                R$ 0,00 aqui é o esperado: neste pacote o valor foi contabilizado uma vez, na
                venda. Cobrar de novo por sessão dobraria a receita.
              </p>
            )
          )}
        </Section>
      )}

      {detail.packageSale && (
        <Section icon={Layers} title="Venda de pacote">
          <div className="grid">
            <Row label="Pacote">{detail.packageSale.packageName}</Row>
            <Row label="Sessões">
              <span className="tabular-nums">{detail.packageSale.totalSessions}</span>
            </Row>
            <Row label="Já usadas">
              <span className="tabular-nums">
                {detail.packageSale.sessionsUsed} de {detail.packageSale.totalSessions}
              </span>
            </Row>
            <Row label="Cobrança">
              {BILLING_MODE[detail.packageSale.billingMode] ?? detail.packageSale.billingMode}
            </Row>
          </div>
        </Section>
      )}

      <Section icon={CreditCard} title="Recebimentos">
        {detail.payments.length === 0 ? (
          <p className="text-[0.8rem] text-muted-foreground">
            {detail.status === "pago"
              ? "Marcado como pago sem recebimento registrado — o caso das sessões de pacote, já quitadas na venda."
              : "Nenhum recebimento registrado."}
          </p>
        ) : (
          <ul className="grid gap-1.5">
            {detail.payments.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-[0.85rem] font-medium">{p.methodName ?? "Forma não informada"}</p>
                  <p className="text-[0.75rem] text-muted-foreground">
                    {formatDateTime(p.paidAt)}
                    {p.receivedByName ? ` · ${p.receivedByName}` : ""}
                  </p>
                  {p.notes && <p className="text-[0.75rem] text-muted-foreground">{p.notes}</p>}
                </div>
                <span className="metric text-[0.9rem] font-semibold tabular-nums">
                  {formatCurrency(p.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {detail.payments.length > 1 && (
          <p className="text-[0.78rem] text-muted-foreground">
            Total recebido: <span className="tabular-nums font-medium">{formatCurrency(pago)}</span>
            {pago !== detail.amount && ` · lançamento: ${formatCurrency(detail.amount)}`}
          </p>
        )}
      </Section>

      {detail.amountChanges.length > 0 && (
        <Section icon={Info} title="Correções de valor">
          <ul className="grid gap-1.5">
            {detail.amountChanges.map((c, i) => (
              <li key={i} className="text-[0.8rem] text-muted-foreground">
                <span className="tabular-nums">
                  {c.from !== null ? formatCurrency(c.from) : "—"} →{" "}
                  <span className="font-medium text-foreground">
                    {c.to !== null ? formatCurrency(c.to) : "—"}
                  </span>
                </span>
                {" · "}
                {formatDateTime(c.at)}
                {c.byName ? ` · ${c.byName}` : ""}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

/**
 * O extrato de uma linha do financeiro.
 *
 * A lista responde "quanto" e "quando"; as perguntas que sobram são "de qual atendimento
 * saiu isto", "qual sessão do pacote foi consumida" e "por que R$ 0,00". Cada uma exige
 * uma tabela diferente, então o detalhe é carregado só quando o modal abre.
 */
export function TransactionDetailDialog({
  transactionId,
  label,
}: {
  transactionId: string
  label: string
}) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<TransactionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next || detail) return
    startTransition(async () => {
      setError(null)
      const result = await getTransactionDetailAction(transactionId)
      if (result.error) setError(result.error)
      else setDetail(result.detail ?? null)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            Detalhes
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-left">{detail?.title ?? label}</DialogTitle>
          <DialogDescription className="text-left">
            Movimento detalhado: origem, atendimento, sessão de pacote e recebimentos.
          </DialogDescription>
        </DialogHeader>

        {isPending && !detail && (
          <div className="grid gap-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {detail && <DetailBody detail={detail} />}
      </DialogContent>
    </Dialog>
  )
}
