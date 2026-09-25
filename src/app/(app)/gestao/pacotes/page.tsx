import { hasPermission, requireAreaAccess } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { listSessionPackages } from "@/services/packages.service"
import { listSpecialties } from "@/services/professionals.service"
import { listProcedures } from "@/services/procedures.service"
import { listGuides, listInsurers, type GuideStatus } from "@/services/billing.service"
import { PageHeader } from "@/components/shared/page-header"
import { TabsContent } from "@/components/ui/tabs"
import { UrlTabs, type UrlTab } from "@/components/shared/url-tabs"
import { ListFilters } from "@/components/shared/list-filters"
import { PackageCatalogTable } from "@/features/packages/components/package-catalog-table"
import { CreatePackageDialog } from "@/features/packages/components/create-package-dialog"
import { InsurersTable } from "@/features/billing/components/insurers-table"
import { CreateInsurerDialog } from "@/features/billing/components/insurer-dialogs"
import { GuidesTable } from "@/features/billing/components/guides-table"
import { GuidesFilters } from "@/features/billing/components/guides-filters"

const SITUACOES_VALIDAS: GuideStatus[] = ["emitida", "enviada", "paga", "glosada", "recusada"]

/**
 * Pacotes, convênios e guias na mesma tela.
 *
 * Os três respondem à mesma pergunta — "de onde vem o dinheiro deste atendimento?" — e a
 * clínica os configura e confere no mesmo momento. Separá-los em entradas de menu
 * diferentes obrigaria a lembrar em qual delas está o que se procura.
 *
 * Três permissões governam três abas, e cada uma aparece sozinha para quem só tem a sua.
 * `billing.view` é a mais fraca das três de propósito: conferir que guia foi emitida é
 * rotina de quem fecha a cobrança, e não exige poder mexer no cadastro do convênio.
 */
export default async function PacotesEConveniosPage({
  searchParams,
}: {
  searchParams: Promise<{
    aba?: string
    mes?: string
    convenio?: string
    situacao?: string
    busca?: string
    status?: string
  }>
}) {
  const membership = await requireAreaAccess(PERMISSIONS.MANAGEMENT_ACCESS, [
    PERMISSIONS.PACKAGES_MANAGE,
    PERMISSIONS.BILLING_MANAGE,
    PERMISSIONS.BILLING_VIEW,
  ])
  const canPackages = hasPermission(membership, PERMISSIONS.PACKAGES_MANAGE)
  const canInsurers = hasPermission(membership, PERMISSIONS.BILLING_MANAGE)
  const canGuides = hasPermission(membership, PERMISSIONS.BILLING_VIEW)

  const { aba, mes, convenio, situacao, busca, status } = await searchParams

  const abas: UrlTab[] = [
    ...(canPackages ? [{ value: "pacotes", label: "Pacotes" }] : []),
    ...(canInsurers ? [{ value: "convenios", label: "Convênios" }] : []),
    ...(canGuides ? [{ value: "guias", label: "Guias emitidas" }] : []),
  ]
  const abaAtiva = abas.some((a) => a.value === aba) ? (aba as string) : (abas[0]?.value ?? "guias")

  // A situação vem da URL, que qualquer um edita: sem esta conferência um valor inventado
  // desceria até a consulta e voltaria como erro de enum do Postgres.
  const situacaoFiltro = SITUACOES_VALIDAS.includes(situacao as GuideStatus)
    ? (situacao as GuideStatus)
    : undefined

  const supabase = await createClient()
  const [packages, specialties, insurers, procedures] = await Promise.all([
    canPackages ? listSessionPackages(supabase, membership.clinicId) : Promise.resolve([]),
    listSpecialties(supabase, membership.clinicId),
    canGuides ? listInsurers(supabase, membership.clinicId) : Promise.resolve([]),
    canInsurers ? listProcedures(supabase, membership.clinicId) : Promise.resolve([]),
  ])

  // Só consulta as guias quando a aba delas está aberta: é a leitura mais cara da tela, e
  // quem veio configurar um pacote não precisa pagar por ela.
  const guides =
    canGuides && abaAtiva === "guias"
      ? await listGuides(supabase, membership.clinicId, {
          month: mes ? `${mes}-01` : undefined,
          insurerId: convenio,
          status: situacaoFiltro,
        })
      : []

  // Sem especialidade ao lado do nome: `procedures` não tem `specialty_id` — no schema o
  // vínculo com especialidade é do PROFISSIONAL, não do procedimento. Foi essa mesma
  // suposição que já quebrou, em silêncio, o filtro por especialidade do financeiro.
  const procedureOptions = (procedures ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    specialtyName: null,
  }))

  // Catálogos pequenos, já trazidos inteiros — filtrar em memória evita reconsultar o banco
  // só para um recorte que cabe todo numa página.
  const buscaLower = busca?.toLowerCase().trim()
  const somenteAtivos = status === "ativo" ? true : status === "inativo" ? false : undefined
  const packagesFiltrados = packages.filter(
    (p) =>
      (buscaLower ? p.name.toLowerCase().includes(buscaLower) : true) &&
      (somenteAtivos === undefined ? true : p.active === somenteAtivos)
  )
  const insurersFiltrados = insurers.filter(
    (i) =>
      (buscaLower ? i.name.toLowerCase().includes(buscaLower) : true) &&
      (somenteAtivos === undefined ? true : i.active === somenteAtivos)
  )

  const statusOptions = [
    { value: "ativo", label: "Ativos" },
    { value: "inativo", label: "Inativos" },
  ]

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Pacotes e convênios"
        description="De onde vem o dinheiro do atendimento: pacote comprado pelo paciente ou convênio que paga a clínica."
      />

      <UrlTabs active={abaAtiva} tabs={abas}>
        {canPackages && (
          <TabsContent value="pacotes" className="grid gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <ListFilters
                fields={[
                  { type: "search", key: "busca", label: "Buscar", placeholder: "Nome do pacote" },
                  { type: "select", key: "status", label: "Situação", placeholder: "Todas", options: statusOptions },
                ]}
              />
              <CreatePackageDialog specialties={specialties ?? []} />
            </div>
            <PackageCatalogTable packages={packagesFiltrados} specialties={specialties ?? []} />
          </TabsContent>
        )}

        {canInsurers && (
          <TabsContent value="convenios" className="grid gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <ListFilters
                fields={[
                  { type: "search", key: "busca", label: "Buscar", placeholder: "Nome do convênio" },
                  { type: "select", key: "status", label: "Situação", placeholder: "Todas", options: statusOptions },
                ]}
              />
              <CreateInsurerDialog procedures={procedureOptions} />
            </div>
            <InsurersTable insurers={insurersFiltrados} procedures={procedureOptions} />
          </TabsContent>
        )}

        {canGuides && (
          <TabsContent value="guias" className="grid gap-3">
            <GuidesFilters
              values={{ mes, convenio, situacao: situacaoFiltro }}
              insurers={insurers.map((i) => ({ id: i.id, name: i.name }))}
            />
            <p className="text-[0.8rem] text-muted-foreground">
              {guides.length === 0
                ? "Nenhuma guia no recorte selecionado."
                : `${guides.length} guia(s) — é o que entra no protocolo do convênio.`}
            </p>
            <GuidesTable
              guides={guides}
              canManage={canInsurers}
              emptyTitle="Nenhuma guia emitida"
              emptyDescription="As guias aparecem aqui quando um atendimento é registrado como convênio no momento do pagamento."
            />
          </TabsContent>
        )}
      </UrlTabs>
    </div>
  )
}
