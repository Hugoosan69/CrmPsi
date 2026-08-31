import { hasPermission, requireAnyPermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import {
  listAllSpecialties,
  listProfessionals,
  listSpecialties,
} from "@/services/professionals.service"
import {
  listAvailability,
  listRooms,
  listScheduleExceptions,
} from "@/services/availability.service"
import { listRoles } from "@/services/users.service"
import { PageHeader } from "@/components/shared/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProfessionalsTable } from "@/features/professionals/components/professionals-table"
import { CreateProfessionalDialog } from "@/features/professionals/components/create-professional-dialog"
import { SpecialtiesPanel } from "@/features/professionals/components/specialties-panel"
import { AvailabilityManager } from "@/features/scheduling/components/availability-manager"
import { RoomsPanel } from "@/features/scheduling/components/rooms-panel"
import { ScheduleExceptionsPanel } from "@/features/scheduling/components/schedule-exceptions-panel"

/**
 * Equipe clínica e a configuração da agenda dela, numa tela só.
 *
 * A configuração da agenda ficava num item próprio da barra lateral, longe daqui. Na prática
 * as duas coisas são feitas na mesma sentada: cadastra-se o profissional e em seguida
 * define-se em que dias e horas ele atende — e procurar por "Configuração da agenda" no menu
 * de gestão não era o caminho por onde ninguém ia olhar.
 *
 * Duas permissões governam as abas, não uma. `professionals.manage` cuida da equipe e do
 * catálogo de especialidades; `agenda.configure` cuida de horários, salas e bloqueios. Quem
 * tem só uma delas vê só as suas abas — exigir as duas tiraria acesso de quem tinha uma.
 */
export default async function ProfessionalsPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>
}) {
  const membership = await requireAnyPermission([
    PERMISSIONS.PROFESSIONALS_MANAGE,
    PERMISSIONS.AGENDA_CONFIGURE,
  ])
  const supabase = await createClient()

  const canManageTeam = hasPermission(membership, PERMISSIONS.PROFESSIONALS_MANAGE)
  const canConfigureAgenda = hasPermission(membership, PERMISSIONS.AGENDA_CONFIGURE)
  // Criar login é decisão de outro dono. Ver a coluna de acesso não depende disso; o botão sim.
  const canManageUsers = hasPermission(membership, PERMISSIONS.USERS_MANAGE)

  // Duas listas de propósito: os seletores de cadastro só devem oferecer especialidades
  // ativas, enquanto a aba de gestão precisa mostrar também as inativas para permitir
  // reativá-las.
  const [professionals, activeSpecialties, allSpecialties] = await Promise.all([
    listProfessionals(supabase, membership.clinicId),
    listSpecialties(supabase, membership.clinicId),
    listAllSpecialties(supabase, membership.clinicId),
  ])

  // Papéis só quando há botão de criar acesso para usar.
  const roles = canManageUsers ? await listRoles(supabase, membership.clinicId) : []

  // Nada da agenda é buscado para quem não pode configurá-la.
  const [rooms, rules, exceptions] = canConfigureAgenda
    ? await Promise.all([
        listRooms(supabase, membership.clinicId),
        listAvailability(supabase, membership.clinicId),
        listScheduleExceptions(supabase, membership.clinicId),
      ])
    : [[], [], []]

  const activeProfessionals = professionals
    .filter((p) => p.active)
    .map((p) => ({ id: p.id, full_name: p.full_name }))

  // A aba inicial vem da URL para que o endereço antigo (/gestao/agenda) e os atalhos do
  // painel possam apontar direto para horários, em vez de largar a pessoa em Equipe.
  const { aba } = await searchParams
  const abas = [
    canManageTeam && "equipe",
    canManageTeam && "especialidades",
    canConfigureAgenda && "horarios",
    canConfigureAgenda && "salas",
    canConfigureAgenda && "bloqueios",
  ].filter(Boolean) as string[]
  const abaInicial = aba && abas.includes(aba) ? aba : abas[0]

  return (
    <div className="grid animate-fade-in-up gap-6">
      <PageHeader
        title="Profissionais"
        description="Equipe clínica, especialidades e a agenda de cada um. A agenda só aceita agendamentos dentro do que estiver definido aqui."
        actions={
          canManageTeam ? <CreateProfessionalDialog specialties={activeSpecialties} /> : undefined
        }
      />

      <Tabs defaultValue={abaInicial}>
        <TabsList>
          {canManageTeam && (
            <>
              <TabsTrigger value="equipe">Equipe</TabsTrigger>
              <TabsTrigger value="especialidades">Especialidades</TabsTrigger>
            </>
          )}
          {canConfigureAgenda && (
            <>
              <TabsTrigger value="horarios">Horários</TabsTrigger>
              <TabsTrigger value="salas">Salas</TabsTrigger>
              <TabsTrigger value="bloqueios">Bloqueios</TabsTrigger>
            </>
          )}
        </TabsList>

        {canManageTeam && (
          <>
            <TabsContent value="equipe" className="mt-5">
              <ProfessionalsTable
                professionals={professionals}
                specialties={activeSpecialties}
                roles={roles}
                canManageUsers={canManageUsers}
              />
            </TabsContent>

            <TabsContent value="especialidades" className="mt-5">
              <SpecialtiesPanel specialties={allSpecialties} />
            </TabsContent>
          </>
        )}

        {canConfigureAgenda && (
          <>
            <TabsContent value="horarios" className="mt-5">
              <AvailabilityManager
                professionals={activeProfessionals}
                rooms={rooms}
                rules={rules}
              />
            </TabsContent>

            <TabsContent value="salas" className="mt-5">
              <RoomsPanel rooms={rooms} />
            </TabsContent>

            <TabsContent value="bloqueios" className="mt-5">
              <ScheduleExceptionsPanel
                professionals={activeProfessionals}
                exceptions={exceptions}
              />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}
