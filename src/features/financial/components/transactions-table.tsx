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

type PaymentMethod = { id: string; name: string }

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatDueDate(value: string | null) {
  if (!value) return "—"
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

export function TransactionsTable({
  transactions,
  paymentMethods,
  canManage,
  canEditAmount = false,
}: {
  transactions: TransactionView[]
  paymentMethods: PaymentMethod[]
  canManage: boolean
  /** financial.edit_amount — corrigir valor é permissão à parte de registrar pagamento. */
  canEditAmount?: boolean
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
          <TableHead>Descrição</TableHead>
          <TableHead>Paciente</TableHead>
          <TableHead>Vencimento</TableHead>
          <TableHead>Valor</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-1" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((t) => (
          <TableRow key={t.id}>
            <TableCell className="font-medium">
              <span className="inline-flex flex-wrap items-center gap-1.5">
                {t.description || t.category || "—"}
                {t.isPackage && (
                  <Badge variant="secondary" className="font-normal">
                    Pacote
                  </Badge>
                )}
              </span>
              {t.category && t.description && (
                <p className="text-xs font-normal text-muted-foreground">{t.category}</p>
              )}
            </TableCell>
            <TableCell>{t.patientName || "—"}</TableCell>
            <TableCell>{formatDueDate(t.due_date)}</TableCell>
            <TableCell className={t.type === "despesa" ? "text-destructive" : ""}>
              {t.type === "despesa" ? "− " : ""}
              {formatCurrency(Number(t.amount))}
            </TableCell>
            <TableCell>
              <TransactionStatusBadge status={t.status} />
            </TableCell>
            <TableCell className="flex justify-end gap-1 text-right">
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
              {canEditAmount && t.status !== "cancelado" && (
                <EditAmountDialog
                  transactionId={t.id}
                  amount={Number(t.amount)}
                  description={t.description}
                />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  )
}
