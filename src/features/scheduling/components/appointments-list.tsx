import { EmptyState } from "@/components/shared/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AppointmentView } from "@/services/scheduling.service"
import { formatTime } from "@/utils/datetime"
import { AppointmentStatusBadge } from "./appointment-status-badge"
import { AppointmentRowActions } from "./appointment-row-actions"
import type { ProcedureOption, ProfessionalOption } from "@/types/options"

export function AppointmentsList({
  appointments,
  professionals,
  procedures,
  canManage,
  canCheckIn,
}: {
  appointments: AppointmentView[]
  professionals: ProfessionalOption[]
  procedures: ProcedureOption[]
  canManage: boolean
  canCheckIn: boolean
}) {
  if (appointments.length === 0) {
    return (
      <EmptyState title="Nenhum agendamento neste dia." />
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Horário</TableHead>
          <TableHead>Paciente</TableHead>
          <TableHead>Profissional</TableHead>
          <TableHead>Procedimento</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-1" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {appointments.map((appointment) => (
          <TableRow key={appointment.id}>
            <TableCell className="font-medium">{formatTime(appointment.scheduled_at)}</TableCell>
            <TableCell>{appointment.patientName}</TableCell>
            <TableCell>{appointment.professionalName}</TableCell>
            <TableCell>{appointment.procedureName || "—"}</TableCell>
            <TableCell>
              <AppointmentStatusBadge status={appointment.status} />
            </TableCell>
            <TableCell>
              <AppointmentRowActions
                appointment={appointment}
                professionals={professionals}
                procedures={procedures}
                canManage={canManage}
                canCheckIn={canCheckIn}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
