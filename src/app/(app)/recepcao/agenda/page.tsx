import { hasPermission, requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import {
  hydrateAppointments,
  listAppointmentsForDay,
  listAppointmentsForRange,
} from "@/services/scheduling.service"
import { listProfessionals } from "@/services/professionals.service"
import { listProcedures } from "@/services/procedures.service"
import {
  listAvailabilityIfAvailable,
  listRoomsIfAvailable,
  listScheduleExceptionsIfAvailable,
} from "@/services/availability.service"
import { PageHeader } from "@/components/shared/page-header"
import { AppointmentsList } from "@/features/scheduling/components/appointments-list"
import { CreateAppointmentDialog } from "@/features/scheduling/components/create-appointment-dialog"
import { AgendaViewNav } from "@/features/scheduling/components/agenda-view-nav"
import { parseView, type AgendaView } from "@/config/agenda"
import { ResourceCalendar, WeekCalendar } from "@/features/scheduling/components/agenda-calendar"
import { addDays, startOfWeek, todaySaoPauloDate } from "@/utils/datetime"

/** Day-by-professional first: it is the screen reception actually works from. */
const VIEWS: AgendaView[] = ["dia", "semana", "lista"]

export default async function RecepcaoAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; vista?: string; profissional?: string }>
}) {
  const membership = await requirePermission(PERMISSIONS.AGENDA_VIEW)
  const { data, vista, profissional } = await searchParams
  const today = todaySaoPauloDate()
  const date = data || today
  const view = parseView(vista, VIEWS)
  const weekStart = startOfWeek(date)

  const supabase = await createClient()

  const [professionals, procedures, rooms, rules, exceptions] = await Promise.all([
    listProfessionals(supabase, membership.clinicId),
    listProcedures(supabase, membership.clinicId),
    listRoomsIfAvailable(supabase, membership.clinicId),
    listAvailabilityIfAvailable(supabase, membership.clinicId),
    listScheduleExceptionsIfAvailable(supabase, membership.clinicId, {
      from: view === "semana" ? weekStart : date,
      to: view === "semana" ? addDays(weekStart, 6) : date,
    }),
  ])

  const activeProfessionals = professionals
    .filter((p) => p.active)
    .map((p) => ({ id: p.id, full_name: p.full_name }))

  // Sem `profissional` na URL, mostra a equipe. O padrão é esse de propósito: quem abre a
  // agenda quer ver o movimento do dia, não o de uma pessoa escolhida por ordem alfabética.
  // Um id que não pertence à clínica é ignorado em vez de consultado.
  const filtroProfissional =
    profissional && activeProfessionals.some((p) => p.id === profissional) ? profissional : null

  // Only fetch the window the current view draws, so the day views never pay for a week
  // of rows they will not render.
  const rawAppointments =
    view === "semana"
      ? await listAppointmentsForRange(
          supabase,
          membership.clinicId,
          weekStart,
          addDays(weekStart, 6),
          filtroProfissional ? { professionalId: filtroProfissional } : {}
        )
      : await listAppointmentsForDay(supabase, membership.clinicId, date)

  const todos = await hydrateAppointments(supabase, rawAppointments)
  // A consulta do dia não filtra por profissional (a vista Dia mostra todos em colunas), então
  // o recorte da Lista é feito aqui.
  const appointments =
    view === "lista" && filtroProfissional
      ? todos.filter((a) => a.professional_id === filtroProfissional)
      : todos

  const canManage = hasPermission(membership, PERMISSIONS.AGENDA_MANAGE)
  const canCheckIn = hasPermission(membership, PERMISSIONS.QUEUE_MANAGE)

  return (
    <div className="grid animate-fade-in-up gap-6">
      <PageHeader
        title="Agenda"
        description="Agendamentos, confirmações e check-in."
        actions={
          canManage && (
            <CreateAppointmentDialog
              professionals={activeProfessionals}
              procedures={procedures.filter((p) => p.active)}
              rooms={rooms}
            />
          )
        }
      />

      <AgendaViewNav
        view={view}
        date={date}
        views={VIEWS}
        professionals={view === "dia" ? undefined : activeProfessionals}
        selectedProfessionalId={filtroProfissional}
      />

      {view === "dia" && (
        <ResourceCalendar
          date={date}
          today={today}
          professionals={activeProfessionals}
          appointments={appointments}
          rules={rules}
          exceptions={exceptions}
          formProfessionals={activeProfessionals}
          procedures={procedures.filter((p) => p.active)}
          rooms={rooms}
          canManage={canManage}
          canCheckIn={canCheckIn}
        />
      )}

      {view === "semana" && (
        <WeekCalendar
          weekStart={weekStart}
          today={today}
          appointments={appointments}
          rules={rules}
          exceptions={exceptions}
          professionalId={filtroProfissional}
          formProfessionals={activeProfessionals}
          procedures={procedures.filter((p) => p.active)}
          rooms={rooms}
          canManage={canManage}
          canCheckIn={canCheckIn}
        />
      )}

      {view === "lista" && (
        <AppointmentsList
          appointments={appointments}
          professionals={professionals}
          procedures={procedures}
          rooms={rooms}
          canManage={canManage}
          canCheckIn={canCheckIn}
        />
      )}
    </div>
  )
}
