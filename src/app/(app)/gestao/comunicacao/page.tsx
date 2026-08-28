import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import {
  listAutomations,
  listCampaigns,
  listMessageTemplates,
} from "@/services/communication.service"
import { listPatients } from "@/services/patients.service"
import { TriangleAlert } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MessageTemplatesTable } from "@/features/communication/components/message-templates-table"
import { CreateMessageTemplateDialog } from "@/features/communication/components/create-message-template-dialog"
import { CampaignForm } from "@/features/communication/components/campaign-form"
import { CampaignsTable } from "@/features/communication/components/campaigns-table"
import { AutomationsPanel } from "@/features/communication/components/automations-panel"

export default async function ComunicacaoPage() {
  const membership = await requirePermission(PERMISSIONS.COMMUNICATION_MANAGE)
  const supabase = await createClient()

  // Campanhas e automações vêm de migrations/007; se ela ainda não rodou, a tela mostra o
  // que existe em vez de quebrar inteira — a aba de modelos continua útil sozinha.
  const [templates, campaigns, automations, patients] = await Promise.all([
    listMessageTemplates(supabase, membership.clinicId),
    listCampaigns(supabase, membership.clinicId).catch(() => []),
    listAutomations(supabase, membership.clinicId).catch(() => []),
    listPatients(supabase, membership.clinicId).catch(() => []),
  ])

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Comunicação"
        description="Campanhas, automações e modelos de mensagem para os pacientes."
      />

      {/* As campanhas gravam a intenção corretamente, mas o disparo automático depende de
          um fluxo externo que ainda não está ligado. Sem este aviso alguém agenda uma
          promoção, vê "agendada" na tela, e descobre que nada saiu quando o cliente
          reclamar. */}
      <div
        className="flex gap-3 rounded-xl border border-status-warning/40 bg-status-warning/5 px-4 py-3.5"
        role="status"
      >
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-status-warning" aria-hidden />
        <div className="text-[0.85rem]">
          <p className="font-medium">Módulo em testes — o envio ainda não está ativo</p>
          <p className="mt-0.5 text-muted-foreground">
            Você pode montar campanhas, definir público e agendar. As mensagens ficam
            registradas, mas <strong>nada é enviado ao paciente</strong> até a integração de
            disparo ser concluída. Use para preparar o conteúdo, não para comunicar de fato.
          </p>
        </div>
      </div>

      <Tabs defaultValue="nova">
        <TabsList>
          <TabsTrigger value="nova">Nova campanha</TabsTrigger>
          <TabsTrigger value="campanhas">Campanhas ({campaigns.length})</TabsTrigger>
          <TabsTrigger value="automacoes">Automações</TabsTrigger>
          <TabsTrigger value="modelos">Modelos</TabsTrigger>
        </TabsList>

        <TabsContent value="nova" className="mt-5">
          <CampaignForm
            patients={patients.map((p) => ({
              id: p.id,
              full_name: p.full_name,
              social_name: p.social_name,
            }))}
          />
        </TabsContent>

        <TabsContent value="campanhas" className="mt-5">
          <CampaignsTable campaigns={campaigns} />
        </TabsContent>

        <TabsContent value="automacoes" className="mt-5">
          <AutomationsPanel automations={automations} templates={templates} />
        </TabsContent>

        <TabsContent value="modelos" className="mt-5">
          <div className="grid gap-4">
            <div className="flex justify-end">
              <CreateMessageTemplateDialog />
            </div>
            <MessageTemplatesTable templates={templates} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
