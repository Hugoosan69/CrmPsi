import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { TransactionView } from "@/services/financial.service"
import { TransactionStatusBadge } from "./transaction-status-badge"
import { RegisterPaymentDialog } from "./register-payment-dialog"
import { CancelTransactionButton } from "./cancel-transaction-button"
import { LinkRetroactivePackageDialog } from "@/features/packages/components/link-retroactive-package-dialog"
import { EditAmountDialog } from "./edit-amount-dialog"
import { TransactionDetailDialog } from "./transaction-detail-dialog"

type PaymentMethod = { id: string; name: string }

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatDueDate(value: string | null) {
  if (!value) return "—"
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

/**
 * O rótulo de um lançamento de pacote é MONTADO na leitura, com o nome que o pacote tem
 * agora — não lido de `description`, que guarda o nome do dia em que a linha nasceu.
 *
 * Era isso que deixava o financeiro com vários nomes para o mesmo pacote: renomear o
 * cadastro não alcançava o texto já gravado, e não havia como alcançar sem reescrever
 * lançamento. Derivando na leitura, renomear reflete em toda tela na hora, e o
 * reprocessamento fica só para o que é de fato dado: valores e sessões.
 */
function describeTransaction(t: TransactionView): string {
  if (t.packageLink) {
    const prefixo = t.packageLink.kind === "venda" ? "Venda de pacote" : "Sessão de pacote"
    return `${prefixo} — ${t.packageLink.packageName}`
  }
  return t.description || t.category || "—"
}

export function TransactionsTable({
  transactions,
  paymentMethods,
  canManage,
  canEditAmount = false,
  canEditPaid = false,
}: {
  transactions: TransactionView[]
  paymentMethods: PaymentMethod[]
  canManage: boolean
  /** financial.edit_amount — corrigir valor é permissão à parte de registrar pagamento. */
  canEditAmount?: boolean
  /** financial.edit_paid — mexer numa linha JÁ PAGA exige as duas (migrations/020). */
  canEditPaid?: boolean
}) {
  if (transactions.length === 0) {
    return (
      <EmptyState title="Nenhum lançamento encontrado." />
    )
  }

  const hasPackageRow = transactions.some((t) => t.isPackage)

  return (
    <div className="grid gap-2">
    {hasPackageRow && (
      // A linha de R$ 0,00 numa sessão de pacote parece erro de lançamento para quem não
      // conhece a regra. Uma frase resolve, e fica só quando há pacote na lista.
      <p className="text-xs text-muted-foreground">
        Pacote: o valor é contabilizado uma vez, na venda. As sessões seguintes aparecem a
        R$ 0,00 — já estão pagas.
      </p>
    )}
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Lançamento</TableHead>
          <TableHead className="hidden md:table-cell">Paciente</TableHead>
          <TableHead className="text-right">Valor</TableHead>
          <TableHead className="hidden sm:table-cell">Status</TableHead>
          <TableHead className="w-1" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((t) => (
          <TableRow key={t.id}>
            <TableCell className="font-medium">
              <span className="inline-flex flex-wrap items-center gap-1.5">
                {describeTransaction(t)}
                {t.isPackage && (
                  <Badge variant="secondary" className="font-normal">
                    Pacote
                  </Badge>
                )}
              </span>
              {/* Numa linha de pacote o título já é o nome atual do pacote; repetir a
                  categoria congelada embaixo era justamente o que mostrava o nome antigo. */}
              {t.category && t.description && !t.packageLink && (
                <p className="text-xs font-normal text-muted-foreground">{t.category}</p>
              )}
              {t.packageLink?.kind === "sessao" && t.category && (
                <p className="text-xs font-normal text-muted-foreground">{t.category}</p>
              )}
              {t.patientName && (
                <p className="text-xs font-normal text-muted-foreground md:hidden">
                  {t.patientName}
                </p>
              )}
            </TableCell>
            <TableCell className="hidden md:table-cell">{t.patientName || "—"}</TableCell>
            <TableCell className="text-right whitespace-nowrap">
              <span className={t.type === "despesa" ? "text-destructive" : ""}>
                {t.type === "despesa" ? "− " : ""}
                {formatCurrency(Number(t.amount))}
              </span>
              {t.due_date && (
                <p className="text-xs font-normal text-muted-foreground">
                  vence {formatDueDate(t.due_date)}
                </p>
              )}
              {/* Abaixo de `sm` a coluna de situação some; o selo desce para cá em vez de
                  sumir junto — situação é o que decide se a linha precisa de ação. */}
              <span className="mt-1 flex justify-end sm:hidden">
                <TransactionStatusBadge status={t.status} />
              </span>
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <TransactionStatusBadge status={t.status} />
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap items-center justify-end gap-1">
              <TransactionDetailDialog
                transactionId={t.id}
                label={describeTransaction(t)}
              />
              {canManage && (t.status === "pendente" || t.status === "atrasado") && (
                <>
                  <RegisterPaymentDialog transactionId={t.id} amount={Number(t.amount)} paymentMethods={paymentMethods} />
                  <CancelTransactionButton transactionId={t.id} />
                </>
              )}
              {/* Requisito 6: lançamentos de R$ 1 ou menos são, por definição, sessões de
                  pacote lançadas como avulso — ver database/migrations/015. Some assim que
                  a linha já está vinculada a um pacote. */}
              {canManage && !t.isPackage && t.status !== "cancelado" && Number(t.amount) <= 1 && (
                <LinkRetroactivePackageDialog transactionId={t.id} patientId={t.patient_id} />
              )}
              {/* Linha paga só é editável por quem tem as DUAS permissões — a Server Action
                  confere de novo, isto aqui é só não oferecer o que vai ser recusado. */}
              {canEditAmount &&
                t.status !== "cancelado" &&
                (t.status !== "pago" || canEditPaid) && (
                  <EditAmountDialog
                    transactionId={t.id}
                    amount={Number(t.amount)}
                    description={t.description}
                    isPaid={t.status === "pago"}
                  />
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  )
}
