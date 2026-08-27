import { StatusDot } from "@/components/shared/status-dot"
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_TONES } from "@/config/agenda"
import type { AppointmentStatus } from "@/types/supabase"

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return <StatusDot tone={APPOINTMENT_STATUS_TONES[status]} label={APPOINTMENT_STATUS_LABELS[status]} />
}
