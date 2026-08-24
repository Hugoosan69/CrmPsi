import Link from "next/link"

import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { hydrateAppointments, listAppointmentsForDay } from "@/services/scheduling.service"
import { getProfessionalByUserId, listProfessionals } from "@/services/professionals.service"
import { listProcedures } from "@/services/procedures.service"
import { AppointmentsList } from "@/features/scheduling/components/appointments-list"
import { DateNav } from "@/features/scheduling/components/date-nav"
import { todaySaoPauloDate } from "@/utils/datetime"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"

export default async function ProfissionalAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>
}) {
  const membership = await requirePermission(PERMISSIONS.SERVICE_MANAGE)
  const { data } = await searchParams
  const date = data || todaySaoPauloDate()

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

  const [rawAppointments, professionals, procedures] = await Promise.all([
    listAppointmentsForDay(supabase, membership.clinicId, date, { professionalId: professional.id }),
    listProfessionals(supabase, membership.clinicId),
    listProcedures(supabase, membership.clinicId),
  ])
  const appointments = await hydrateAppointments(supabase, rawAppointments)

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Minha agenda"
        description={professional.full_name}
        actions={<Button nativeButton={false} variant="outline" render={<Link href="/profissional/fila">Ir para a fila</Link>} />}
      />
      <DateNav date={date} />
      <AppointmentsList
        appointments={appointments}
        professionals={professionals}
        procedures={procedures}
        canManage={false}
        canCheckIn={false}
      />
    </div>
  )
}
