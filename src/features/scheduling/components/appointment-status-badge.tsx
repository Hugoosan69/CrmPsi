import { StatusDot, type StatusTone } from "@/components/shared/status-dot"
import type { AppointmentStatus } from "@/types/supabase"

const LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
  completed: "Concluído",
}

const TONES: Record<AppointmentStatus, StatusTone> = {
  scheduled: "neutral",
  confirmed: "info",
  cancelled: "danger",
  no_show: "warning",
  completed: "success",
}

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return <StatusDot tone={TONES[status]} label={LABELS[status]} />
}
