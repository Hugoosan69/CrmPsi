import { hasPermission, requireAnyPermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { listSessionPackages } from "@/services/packages.service"
import { listSpecialties } from "@/services/professionals.service"
import { listInsurers } from "@/services/billing.service"
import { PageHeader } from "@/components/shared/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PackageCatalogTable } from "@/features/packages/components/package-catalog-table"
import { CreatePackageDialog } from "@/features/packages/components/create-package-dialog"
import { InsurersTable } from "@/features/billing/components/insurers-table"
import { CreateInsurerDialog } from "@/features/billing/components/insurer-dialogs"

/**
 * Pacotes e convênios na mesma tela.
 *
 * Os dois respondem à mesma pergunta — "de onde vem o dinheiro deste atendimento?" — e a
 * clínica os configura no mesmo momento. Separá-los em duas entradas de menu obrigaria a
 * lembrar em qual delas está o que se procura.
 */
export default async function PacotesEConveniosPage() {
  const membership = await requireAnyPermission([
    PERMISSIONS.PACKAGES_MANAGE,
    PERMISSIONS.BILLING_MANAGE,
  ])
  const canPackages = hasPermission(membership, PERMISSIONS.PACKAGES_MANAGE)
  const canInsurers = hasPermission(membership, PERMISSIONS.BILLING_MANAGE)

  const supabase = await createClient()
  const [packages, specialties, insurers] = await Promise.all([
    canPackages ? listSessionPackages(supabase, membership.clinicId) : Promise.resolve([]),
    listSpecialties(supabase, membership.clinicId),
    canInsurers ? listInsurers(supabase, membership.clinicId) : Promise.resolve([]),
  ])

  const abaInicial = canPackages ? "pacotes" : "convenios"

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Pacotes e convênios"
        description="De onde vem o dinheiro do atendimento: pacote comprado pelo paciente ou convênio que paga a clínica."
      />

      <Tabs defaultValue={abaInicial} className="grid gap-4">
        <TabsList>
          {canPackages && <TabsTrigger value="pacotes">Pacotes</TabsTrigger>}
          {canInsurers && <TabsTrigger value="convenios">Convênios</TabsTrigger>}
        </TabsList>

        {canPackages && (
          <TabsContent value="pacotes" className="grid gap-3">
            <div className="flex justify-end">
              <CreatePackageDialog specialties={specialties ?? []} />
            </div>
            <PackageCatalogTable packages={packages} specialties={specialties ?? []} />
          </TabsContent>
        )}

        {canInsurers && (
          <TabsContent value="convenios" className="grid gap-3">
            <div className="flex justify-end">
              <CreateInsurerDialog />
            </div>
            <InsurersTable insurers={insurers} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
