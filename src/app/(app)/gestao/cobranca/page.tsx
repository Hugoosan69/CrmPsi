import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { listBillingTypes } from "@/services/billing.service"
import { PageHeader } from "@/components/shared/page-header"
import { BillingTypesTable } from "@/features/billing/components/billing-types-table"
import { CreateBillingTypeDialog } from "@/features/billing/components/create-billing-type-dialog"

/**
 * Como a clínica cobra.
 *
 * Fica em Gestão e não em Procedimentos porque o assunto é dinheiro, não catálogo clínico:
 * quem cadastra um procedimento não decide com quem a clínica fatura.
 */
export default async function CobrancaPage() {
  const membership = await requirePermission(PERMISSIONS.BILLING_MANAGE)
  const supabase = await createClient()
  const billingTypes = await listBillingTypes(supabase, membership.clinicId)

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Tipos de cobrança"
        description="Quem paga cada atendimento: o paciente, um convênio ou ninguém."
        actions={<CreateBillingTypeDialog />}
      />
      <BillingTypesTable billingTypes={billingTypes} />
    </div>
  )
}
