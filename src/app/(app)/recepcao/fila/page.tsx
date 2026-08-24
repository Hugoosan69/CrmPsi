import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { listProfessionals, listSpecialties } from "@/services/professionals.service"
import { listProcedures } from "@/services/procedures.service"
import { listPaymentMethods } from "@/services/financial.service"
import { PageHeader } from "@/components/shared/page-header"
import { QueueList } from "@/features/queue/components/queue-list"
import { AddToQueueDialog } from "@/features/queue/components/add-to-queue-dialog"

export default async function RecepcaoFilaPage() {
  const membership = await requirePermission(PERMISSIONS.QUEUE_MANAGE)
  const supabase = await createClient()
  const [professionals, specialties, procedures, paymentMethods] = await Promise.all([
    listProfessionals(supabase, membership.clinicId),
    listSpecialties(supabase, membership.clinicId),
    listProcedures(supabase, membership.clinicId),
    listPaymentMethods(supabase, membership.clinicId),
  ])

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Fila"
        description="Pagamento confirmado libera o paciente para a fila."
        actions={
          <AddToQueueDialog
            professionals={professionals.filter((p) => p.active)}
            specialties={specialties}
            procedures={procedures.filter((p) => p.active)}
          />
        }
      />
      <QueueList paymentMethods={paymentMethods} />
    </div>
  )
}
