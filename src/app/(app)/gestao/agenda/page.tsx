import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { listProfessionals } from "@/services/professionals.service"
import {
  listAvailability,
  listRooms,
  listScheduleExceptions,
} from "@/services/availability.service"
import { PageHeader } from "@/components/shared/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AvailabilityManager } from "@/features/scheduling/components/availability-manager"
import { RoomsPanel } from "@/features/scheduling/components/rooms-panel"
import { ScheduleExceptionsPanel } from "@/features/scheduling/components/schedule-exceptions-panel"

export default async function AgendaSettingsPage() {
  const membership = await requirePermission(PERMISSIONS.AGENDA_CONFIGURE)
  const supabase = await createClient()

  const [professionals, rooms, rules, exceptions] = await Promise.all([
    listProfessionals(supabase, membership.clinicId),
    listRooms(supabase, membership.clinicId),
    listAvailability(supabase, membership.clinicId),
    listScheduleExceptions(supabase, membership.clinicId),
  ])

  const activeProfessionals = professionals
    .filter((p) => p.active)
    .map((p) => ({ id: p.id, full_name: p.full_name }))

  return (
    <div className="grid animate-fade-in-up gap-6">
      <PageHeader
        title="Configuração da agenda"
        description="Horário de atendimento, salas e bloqueios. A agenda só aceita agendamentos dentro do que estiver definido aqui."
      />

      <Tabs defaultValue="horarios">
        <TabsList>
          <TabsTrigger value="horarios">Horários</TabsTrigger>
          <TabsTrigger value="salas">Salas</TabsTrigger>
          <TabsTrigger value="bloqueios">Bloqueios</TabsTrigger>
        </TabsList>

        <TabsContent value="horarios" className="mt-5">
          <AvailabilityManager professionals={activeProfessionals} rooms={rooms} rules={rules} />
        </TabsContent>

        <TabsContent value="salas" className="mt-5">
          <RoomsPanel rooms={rooms} />
        </TabsContent>

        <TabsContent value="bloqueios" className="mt-5">
          <ScheduleExceptionsPanel professionals={activeProfessionals} exceptions={exceptions} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
