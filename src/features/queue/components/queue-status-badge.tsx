import { StatusDot, type StatusTone } from "@/components/shared/status-dot"
import type { QueueStatus } from "@/types/supabase"

const LABELS: Record<QueueStatus, string> = {
  payment_pending: "Pagamento pendente",
  released: "Liberado — enviar para fila",
  waiting: "Aguardando",
  called: "Chamado",
  in_service: "Em atendimento",
  paused: "Pausado",
  completed: "Finalizado",
  cancelled: "Cancelado",
}

const TONES: Record<QueueStatus, StatusTone> = {
  payment_pending: "danger",
  released: "info",
  waiting: "warning",
  called: "info",
  in_service: "success",
  paused: "warning",
  completed: "neutral",
  cancelled: "danger",
}

export function QueueStatusBadge({ status }: { status: QueueStatus }) {
  // `in_service` and `called` pulse so a live board reads at a glance from across
  // the reception desk — the only animated status, so it stays meaningful.
  const live = status === "in_service" || status === "called"
  return <StatusDot tone={TONES[status]} label={LABELS[status]} pulse={live} />
}
