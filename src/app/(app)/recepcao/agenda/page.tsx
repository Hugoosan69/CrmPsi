import { hasPermission, requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { hydrateAppointments, listAppointmentsForDay } from "@/services/scheduling.service"
import { listProfessionals } from "@/services/professionals.service"
import { listProcedures } from "@/services/procedures.service"
import { PageHeader } from "@/components/shared/page-header"
import { AppointmentsList } from "@/features/scheduling/components/appointments-list"
import { CreateAppointmentDialog } from "@/features/scheduling/components/create-appointment-dialog"
import { DateNav } from "@/features/scheduling/components/date-nav"
import { todaySaoPauloDate } from "@/utils/datetime"

export default async function RecepcaoAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>
}) {
  const membership = await requirePermission(PERMISSIONS.AGENDA_VIEW)
  const { data } = await searchParams
  const date = data || todaySaoPauloDate()

  const supabase = await createClient()
  const [rawAppointments, professionals, procedures] = await Promise.all([
    listAppointmentsForDay(supabase, membership.clinicId, date),
    listProfessionals(supabase, membership.clinicId),
    listProcedures(supabase, membership.clinicId),
  ])
  const appointments = await hydrateAppointments(supabase, rawAppointments)

  const canManage = hasPermission(membership, PERMISSIONS.AGENDA_MANAGE)
  const canCheckIn = hasPermission(membership, PERMISSIONS.QUEUE_MANAGE)

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Agenda"
        description="Agendamentos, confirmações e check-in."
        actions={
          canManage && (
            <CreateAppointmentDialog
              professionals={professionals.filter((p) => p.active)}
              procedures={procedures.filter((p) => p.active)}
            />
          )
        }
      />
      <DateNav date={date} />
      <AppointmentsList
        appointments={appointments}
        professionals={professionals}
        procedures={procedures}
        canManage={canManage}
        canCheckIn={canCheckIn}
      />
    </div>
  )
}
