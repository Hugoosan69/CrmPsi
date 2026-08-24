import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { listMessageTemplates } from "@/services/communication.service"
import { PageHeader } from "@/components/shared/page-header"
import { MessageTemplatesTable } from "@/features/communication/components/message-templates-table"
import { CreateMessageTemplateDialog } from "@/features/communication/components/create-message-template-dialog"

export default async function ComunicacaoPage() {
  const membership = await requirePermission(PERMISSIONS.SETTINGS_MANAGE)
  const supabase = await createClient()
  const templates = await listMessageTemplates(supabase, membership.clinicId)

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Comunicação"
        description="Modelos de confirmação, lembrete, aniversário e mensagens pós-atendimento."
        actions={<CreateMessageTemplateDialog />}
      />
      <MessageTemplatesTable templates={templates} />
    </div>
  )
}
