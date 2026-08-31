import { hasPermission, requireAnyPermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { parsePagination } from "@/config/pagination"
import {
  listAllSpecialties,
  listProfessionals,
  listProfessionalsPage,
  listSpecialties,
} from "@/services/professionals.service"
import {
  listAvailability,
  listRooms,
  listScheduleExceptions,
} from "@/services/availability.service"
import { listRoles } from "@/services/users.service"
import { PageHeader } from "@/components/shared/page-header"
import { PaginationBar } from "@/components/shared/pagination-bar"
import { TabsContent } from "@/components/ui/tabs"
import { ProfessionalsTabs } from "@/features/professionals/components/professionals-tabs"
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
 * define-se em que dias e horas ele atende.
 *
 * Duas permissões governam as abas, não uma. `professionals.manage` cuida da equipe e do
 * catálogo de especialidades; `agenda.configure` cuida de horários, salas e bloqueios. Quem
 * tem só uma delas vê só as suas abas.
 *
 * A aba ativa vive na URL, e as quatro listas compartilham um único par de parâmetros de
 * paginação. Isso funciona porque só uma aba está visível por vez, e trocar de aba zera a
 * página — a página 3 da equipe não corresponde a nada em salas.
 */
const ABAS = ["equipe", "especialidades", "horarios", "salas", "bloqueios"] as const
type Aba = (typeof ABAS)[number]

export default async function ProfessionalsPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; pagina?: string; por?: string }>
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

  const { aba, pagina, por } = await searchParams
  const disponiveis = ABAS.filter((a) =>
    a === "equipe" || a === "especialidades" ? canManageTeam : canConfigureAgenda
  )
  const abaAtiva: Aba = disponiveis.includes(aba as Aba) ? (aba as Aba) : disponiveis[0]
  const { page, pageSize, offset, rangeEnd } = parsePagination({ page: pagina, pageSize: por })

  // Só a aba visível é paginada; as demais consultas alimentam seletores e precisam vir
  // inteiras. `listProfessionals` (sem sufixo) é a lista completa que os seletores de
  // horários e bloqueios usam.
  const recorte = { offset, rangeEnd }

  const [equipe, especialidadesAtivas, especialidades, todosProfissionais] = await Promise.all([
    canManageTeam
      ? listProfessionalsPage(supabase, membership.clinicId, abaAtiva === "equipe" ? recorte : {})
      : Promise.resolve({ rows: [], total: 0 }),
    listSpecialties(supabase, membership.clinicId),
    canManageTeam
      ? listAllSpecialties(
          supabase,
          membership.clinicId,
          abaAtiva === "especialidades" ? recorte : {}
        )
      : Promise.resolve({ rows: [], total: 0 }),
    canConfigureAgenda
      ? listProfessionals(supabase, membership.clinicId)
      : Promise.resolve([]),
  ])

  const roles = canManageUsers ? await listRoles(supabase, membership.clinicId) : []

  // Nada da agenda é buscado para quem não pode configurá-la.
  const [salas, todasAsSalas, regras, bloqueios] = canConfigureAgenda
    ? await Promise.all([
        listRooms(supabase, membership.clinicId, abaAtiva === "salas" ? recorte : {}),
        // Lista inteira: é o seletor de sala da aba de horários.
        listRooms(supabase, membership.clinicId),
        listAvailability(supabase, membership.clinicId),
        listScheduleExceptions(
          supabase,
          membership.clinicId,
          abaAtiva === "bloqueios" ? recorte : {}
        ),
      ])
    : [{ rows: [], total: 0 }, { rows: [], total: 0 }, [], { rows: [], total: 0 }]

  const profissionaisAtivos = todosProfissionais
    .filter((p) => p.active)
    .map((p) => ({ id: p.id, full_name: p.full_name }))

  return (
    <div className="grid animate-fade-in-up gap-6">
      <PageHeader
        title="Profissionais"
        description="Equipe clínica, especialidades e a agenda de cada um. A agenda só aceita agendamentos dentro do que estiver definido aqui."
        actions={
          canManageTeam ? <CreateProfessionalDialog specialties={especialidadesAtivas} /> : undefined
        }
      />

      <ProfessionalsTabs active={abaAtiva} abas={disponiveis}>
        {canManageTeam && (
          <>
            <TabsContent value="equipe" className="mt-5">
              <div className="grid gap-3">
                <ProfessionalsTable
                  professionals={equipe.rows}
                  specialties={especialidadesAtivas}
                  roles={roles}
                  canManageUsers={canManageUsers}
                />
                <PaginationBar
                  total={equipe.total}
                  page={page}
                  pageSize={pageSize}
                  label="profissionais"
                />
              </div>
            </TabsContent>

            <TabsContent value="especialidades" className="mt-5">
              <div className="grid gap-3">
                <SpecialtiesPanel specialties={especialidades.rows} />
                <PaginationBar
                  total={especialidades.total}
                  page={page}
                  pageSize={pageSize}
                  label="especialidades"
                />
              </div>
            </TabsContent>
          </>
        )}

        {canConfigureAgenda && (
          <>
            <TabsContent value="horarios" className="mt-5">
              <AvailabilityManager
                professionals={profissionaisAtivos}
                rooms={todasAsSalas.rows}
                rules={regras}
              />
            </TabsContent>

            <TabsContent value="salas" className="mt-5">
              <div className="grid gap-3">
                <RoomsPanel rooms={salas.rows} />
                <PaginationBar
                  total={salas.total}
                  page={page}
                  pageSize={pageSize}
                  label="salas"
                />
              </div>
            </TabsContent>

            <TabsContent value="bloqueios" className="mt-5">
              <div className="grid gap-3">
                <ScheduleExceptionsPanel
                  professionals={profissionaisAtivos}
                  exceptions={bloqueios.rows}
                />
                <PaginationBar
                  total={bloqueios.total}
                  page={page}
                  pageSize={pageSize}
                  label="bloqueios"
                />
              </div>
            </TabsContent>
          </>
        )}
      </ProfessionalsTabs>
    </div>
  )
}
