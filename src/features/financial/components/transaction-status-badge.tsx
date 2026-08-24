import { StatusDot, type StatusTone } from "@/components/shared/status-dot"
import type { FinancialTransactionStatus } from "@/types/supabase"

const LABELS: Record<FinancialTransactionStatus, string> = {
  pendente: "Pendente",
  pago: "Pago",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
}

const TONES: Record<FinancialTransactionStatus, StatusTone> = {
  pendente: "warning",
  pago: "success",
  atrasado: "danger",
  cancelado: "neutral",
}

export function TransactionStatusBadge({ status }: { status: FinancialTransactionStatus }) {
  return <StatusDot tone={TONES[status]} label={LABELS[status]} />
}
