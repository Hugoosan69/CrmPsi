import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { getProfessionalByUserId, listProfessionals } from "@/services/professionals.service"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { ProfessionalQueuePanel } from "@/features/service/components/professional-queue-panel"

export default async function ProfissionalFilaPage() {
  const membership = await requirePermission(PERMISSIONS.SERVICE_MANAGE)
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

  const professionals = await listProfessionals(supabase, membership.clinicId)

  return (
    <div className="grid gap-6">
      <PageHeader title="Minha fila" description={professional.full_name} />
      <ProfessionalQueuePanel professionalId={professional.id} professionals={professionals.filter((p) => p.active)} />
    </div>
  )
}
