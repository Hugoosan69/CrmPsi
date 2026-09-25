import { requireAreaAccess } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import {
  listAutomations,
  listCampaigns,
  listMessageTemplates,
} from "@/services/communication.service"
import { listPatients } from "@/services/patients.service"

import { parsePagination } from "@/config/pagination"
import { PageHeader } from "@/components/shared/page-header"
import { PaginationBar } from "@/components/shared/pagination-bar"
import { ListFilters } from "@/components/shared/list-filters"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MessageTemplatesTable } from "@/features/communication/components/message-templates-table"
import { CreateMessageTemplateDialog } from "@/features/communication/components/create-message-template-dialog"
import { CampaignForm } from "@/features/communication/components/campaign-form"
import { CampaignsTable } from "@/features/communication/components/campaigns-table"
import { AutomationsPanel } from "@/features/communication/components/automations-panel"

export default async function ComunicacaoPage({
  searchParams,
}: {
  searchParams: Promise<{
    pagina?: string
    por?: string
    status?: string
    canal?: string
    busca?: string
    tipo?: string
  }>
}) {
  const membership = await requireAreaAccess(PERMISSIONS.MANAGEMENT_ACCESS, PERMISSIONS.COMMUNICATION_MANAGE)
  const supabase = await createClient()

  const { pagina, por, status, canal, busca, tipo } = await searchParams
  const { page, pageSize, offset, rangeEnd } = parsePagination({ page: pagina, pageSize: por })

  // Campanhas e automações vêm de migrations/007; se ela ainda não rodou, a tela mostra o
  // que existe em vez de quebrar inteira — a aba de modelos continua útil sozinha.
  const [templates, campaigns, automations, patients] = await Promise.all([
    listMessageTemplates(supabase, membership.clinicId),
    listCampaigns(supabase, membership.clinicId, {
      offset,
      rangeEnd,
      status: status || undefined,
      channel: canal || undefined,
    }).catch(() => ({
      rows: [],
      total: 0,
    })),
    listAutomations(supabase, membership.clinicId).catch(() => []),
    // O seletor de público precisa da lista inteira, não de uma página: quem monta uma
    // campanha para "um paciente só" tem de encontrar qualquer um deles. Antes vinha
    // cortada em 50 sem avisar, o que tornava metade do cadastro inalcançável aqui.
    listPatients(supabase, membership.clinicId, { rangeEnd: 4999 }).catch(() => ({
      rows: [],
      total: 0,
    })),
  ])

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Comunicação"
        description="Campanhas, automações e modelos de mensagem para os pacientes."
      />

      <Tabs defaultValue="nova">
        <TabsList>
          <TabsTrigger value="nova">Nova campanha</TabsTrigger>
          <TabsTrigger value="campanhas">Campanhas ({campaigns.total})</TabsTrigger>
          <TabsTrigger value="automacoes">Automações</TabsTrigger>
          <TabsTrigger value="modelos">Modelos</TabsTrigger>
        </TabsList>

        <TabsContent value="nova" className="mt-5">
          <CampaignForm
            patients={patients.rows.map((p) => ({
              id: p.id,
              full_name: p.full_name,
              social_name: p.social_name,
            }))}
          />
        </TabsContent>

        <TabsContent value="campanhas" className="mt-5">
          <div className="grid gap-3">
            <ListFilters
              fields={[
                {
                  type: "select",
                  key: "status",
                  label: "Situação",
                  placeholder: "Todas",
                  options: [
                    { value: "draft", label: "Rascunho" },
                    { value: "scheduled", label: "Agendada" },
                    { value: "sending", label: "Enviando" },
                    { value: "sent", label: "Enviada" },
                    { value: "cancelled", label: "Cancelada" },
                    { value: "failed", label: "Falhou" },
                  ],
                },
                {
                  type: "select",
                  key: "canal",
                  label: "Canal",
                  placeholder: "Todos",
                  options: [
                    { value: "whatsapp", label: "WhatsApp" },
                    { value: "sms", label: "SMS" },
                    { value: "email", label: "E-mail" },
                  ],
                },
              ]}
            />
            <CampaignsTable campaigns={campaigns.rows} />
            <PaginationBar
              total={campaigns.total}
              page={page}
              pageSize={pageSize}
              label="campanhas"
            />
          </div>
        </TabsContent>

        <TabsContent value="automacoes" className="mt-5">
          <AutomationsPanel automations={automations} templates={templates} />
        </TabsContent>

        <TabsContent value="modelos" className="mt-5">
          <div className="grid gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <ListFilters
                fields={[
                  { type: "search", key: "busca", label: "Buscar", placeholder: "Assunto" },
                  {
                    type: "select",
                    key: "tipo",
                    label: "Tipo",
                    placeholder: "Todos",
                    options: [
                      { value: "confirmation", label: "Confirmação" },
                      { value: "reminder", label: "Lembrete" },
                      { value: "birthday", label: "Aniversário" },
                      { value: "post_visit", label: "Pós-atendimento" },
                      { value: "general", label: "Geral" },
                    ],
                  },
                  {
                    type: "select",
                    key: "canal",
                    label: "Canal",
                    placeholder: "Todos",
                    options: [
                      { value: "whatsapp", label: "WhatsApp" },
                      { value: "sms", label: "SMS" },
                      { value: "email", label: "E-mail" },
                    ],
                  },
                ]}
              />
              <CreateMessageTemplateDialog />
            </div>
            <MessageTemplatesTable
              templates={templates.filter(
                (t) =>
                  (tipo ? t.type === tipo : true) &&
                  (canal ? t.channel === canal : true) &&
                  (busca ? (t.subject ?? "").toLowerCase().includes(busca.toLowerCase()) : true)
              )}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
