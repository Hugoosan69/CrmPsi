import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import {
  listAllSpecialties,
  listProfessionals,
  listSpecialties,
} from "@/services/professionals.service"
import { PageHeader } from "@/components/shared/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProfessionalsTable } from "@/features/professionals/components/professionals-table"
import { CreateProfessionalDialog } from "@/features/professionals/components/create-professional-dialog"
import { SpecialtiesPanel } from "@/features/professionals/components/specialties-panel"

export default async function ProfessionalsPage() {
  const membership = await requirePermission(PERMISSIONS.PROFESSIONALS_MANAGE)
  const supabase = await createClient()

  // Duas listas de propósito: os seletores de cadastro só devem oferecer especialidades
  // ativas, enquanto a aba de gestão precisa mostrar também as inativas para permitir
  // reativá-las.
  const [professionals, activeSpecialties, allSpecialties] = await Promise.all([
    listProfessionals(supabase, membership.clinicId),
    listSpecialties(supabase, membership.clinicId),
    listAllSpecialties(supabase, membership.clinicId),
  ])

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Profissionais"
        description="Equipe clínica, especialidades e agenda."
        actions={<CreateProfessionalDialog specialties={activeSpecialties} />}
      />

      <Tabs defaultValue="equipe">
        <TabsList>
          <TabsTrigger value="equipe">Equipe</TabsTrigger>
          <TabsTrigger value="especialidades">Especialidades</TabsTrigger>
        </TabsList>

        <TabsContent value="equipe" className="mt-5">
          <ProfessionalsTable professionals={professionals} specialties={activeSpecialties} />
        </TabsContent>

        <TabsContent value="especialidades" className="mt-5">
          <SpecialtiesPanel specialties={allSpecialties} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
