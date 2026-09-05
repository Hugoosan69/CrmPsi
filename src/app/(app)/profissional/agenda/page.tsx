import Link from "next/link"

import { hasPermission, requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import {
  hydrateAppointments,
  listAppointmentsForDay,
  listAppointmentsForRange,
  listPendingClosures,
} from "@/services/scheduling.service"
import { getProfessionalByUserId, listProfessionals } from "@/services/professionals.service"
import { listProcedures } from "@/services/procedures.service"
import {
  listAvailabilityIfAvailable,
  listRoomsIfAvailable,
  listScheduleExceptionsIfAvailable,
} from "@/services/availability.service"
import { AppointmentsList } from "@/features/scheduling/components/appointments-list"
import { AgendaViewNav } from "@/features/scheduling/components/agenda-view-nav"
import { parseView, type AgendaView } from "@/config/agenda"
import { WeekCalendar } from "@/features/scheduling/components/agenda-calendar"
import { OwnAvailabilityPanel } from "@/features/scheduling/components/own-availability-panel"
import { addDays, startOfWeek, todaySaoPauloDate } from "@/utils/datetime"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { PendingClosuresAlert } from "@/features/scheduling/components/pending-closures-alert"
import { EmptyState } from "@/components/shared/empty-state"

/** The professional's own week is the useful default — a single day of one person's
 *  agenda is what the fila already shows better. */
const VIEWS: AgendaView[] = ["semana", "lista", "horarios"]

export default async function ProfissionalAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; vista?: string }>
}) {
  const membership = await requirePermission(PERMISSIONS.SERVICE_MANAGE)
  // A professional can open the modal to read the booking; acting on it needs
  // agenda.manage, which the seeded `professional` role does not have.
  const canManageAgenda = hasPermission(membership, PERMISSIONS.AGENDA_MANAGE)
  const { data, vista } = await searchParams
  const today = todaySaoPauloDate()
  const date = data || today
  const view = parseView(vista, VIEWS)
  const weekStart = startOfWeek(date)

  const supabase = await createClient()
  const professional = await getProfessionalByUserId(supabase, membership.clinicId, membership.userId)

  if (!professional) {
    return (
      <EmptyState
        title="Sem cadastro de profissional vinculado"
        description="Peça à gestão para vincular seu usuário em Profissionais."
        showMascot={false}
      />
    )
  }

  const [rawAppointments, professionals, procedures, rules, rooms, exceptions] = await Promise.all([
    view === "semana"
      ? listAppointmentsForRange(
          supabase,
          membership.clinicId,
          weekStart,
          addDays(weekStart, 6),
          { professionalId: professional.id }
        )
      : listAppointmentsForDay(supabase, membership.clinicId, date, {
          professionalId: professional.id,
        }),
    listProfessionals(supabase, membership.clinicId),
    listProcedures(supabase, membership.clinicId),
    listAvailabilityIfAvailable(supabase, membership.clinicId, professional.id),
    listRoomsIfAvailable(supabase, membership.clinicId),
    listScheduleExceptionsIfAvailable(supabase, membership.clinicId, {
      from: view === "semana" ? weekStart : date,
      to: view === "semana" ? addDays(weekStart, 6) : date,
    }),
  ])
  const appointments = await hydrateAppointments(supabase, rawAppointments)

  // Só os atendimentos dele: é quem sabe dizer se o paciente veio ou não.
  const pendingClosures = canManageAgenda
    ? await listPendingClosures(supabase, membership.clinicId, {
        professionalId: professional.id,
      })
    : []

  return (
    <div className="grid animate-fade-in-up gap-6">
      <PageHeader
        title="Minha agenda"
        description={professional.full_name}
        actions={
          <Button
            nativeButton={false}
            variant="outline"
            render={<Link href="/profissional/fila">Ir para a fila</Link>}
          />
        }
      />

      <PendingClosuresAlert appointments={pendingClosures} />

      <AgendaViewNav view={view} date={date} views={VIEWS} />

      {view === "horarios" ? (
        <OwnAvailabilityPanel rules={rules} rooms={rooms} />
      ) : view === "semana" ? (
        <WeekCalendar
          weekStart={weekStart}
          today={today}
          appointments={appointments}
          rules={rules}
          exceptions={exceptions}
          professionalId={professional.id}
          formProfessionals={professionals
            .filter((p) => p.active)
            .map((p) => ({ id: p.id, full_name: p.full_name }))}
          procedures={procedures.filter((p) => p.active)}
          canManage={canManageAgenda}
          canCheckIn={false}
        />
      ) : (
        <AppointmentsList
          appointments={appointments}
          professionals={professionals}
          procedures={procedures}
          canManage={false}
          canCheckIn={false}
        />
      )}
    </div>
  )
}
