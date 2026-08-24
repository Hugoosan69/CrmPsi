import { EmptyState } from "@/components/shared/empty-state"
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
}: {
  transactions: TransactionView[]
  paymentMethods: PaymentMethod[]
  canManage: boolean
}) {
  if (transactions.length === 0) {
    return (
      <EmptyState title="Nenhum lançamento encontrado." />
    )
  }

  return (
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
              {t.description || t.category || "—"}
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
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
