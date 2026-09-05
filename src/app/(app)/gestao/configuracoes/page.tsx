import { hasPermission, requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import {
  getAgendaStatusColors,
  getClinicBranding,
  getN8nIntegration,
} from "@/services/clinic-settings.service"
import { fetchWahaQrDataUri, getWahaConfig, getWahaStatus } from "@/services/waha.service"
import { PageHeader } from "@/components/shared/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AgendaColorsSettings } from "@/features/settings/components/agenda-colors-settings"
import { BrandingSettings } from "@/features/settings/components/branding-settings"
import { N8nSettings } from "@/features/settings/components/n8n-settings"
import { WahaSettings } from "@/features/settings/components/waha-settings"

export default async function ConfiguracoesPage() {
  const membership = await requirePermission(PERMISSIONS.SETTINGS_MANAGE)
  const supabase = await createClient()

  // Integrações exigem permissão própria, acima de administrador: quem as configura
  // controla o número de WhatsApp da clínica e o destino dos pagamentos. Sem ela a pessoa
  // ainda cuida da identidade visual, mas as abas de integração nem chegam a existir — e
  // as Server Actions por trás delas exigem o mesmo, então esconder aqui é conveniência,
  // não a barreira.
  const canManageIntegrations = hasPermission(membership, PERMISSIONS.INTEGRATIONS_MANAGE)
  // Cores da agenda têm permissão própria (migrations/021): mexer na leitura da tela em que
  // a equipe trabalha o dia inteiro é decisão à parte de trocar a logo.
  const canSetAgendaColors = hasPermission(membership, PERMISSIONS.AGENDA_APPEARANCE)

  const branding = await getClinicBranding(supabase, membership.clinicId)
  const agendaColors = canSetAgendaColors
    ? await getAgendaStatusColors(supabase, membership.clinicId)
    : null

  // Nada de integração é buscado para quem não pode vê-la: sem isso a página bateria no
  // servidor do WAHA em toda carga de quem só ia trocar a logo.
  const [n8n, waha] = canManageIntegrations
    ? await Promise.all([
        getN8nIntegration(supabase, membership.clinicId),
        getWahaConfig(supabase, membership.clinicId),
      ])
    : [null, null]

  // Consultado no servidor a cada carga: o estado da sessão do WhatsApp muda por fora do
  // sistema (o dono desvincula o aparelho, a VPS reinicia), então guardá-lo mostraria uma
  // conexão que já caiu.
  const wahaStatus = waha ? await getWahaStatus(waha) : null
  // Buscado já na renderização quando há QR para ler: assim o código aparece junto com a
  // página, sem um segundo salto que deixaria a área piscando vazia.
  const wahaQr =
    waha && wahaStatus?.status === "SCAN_QR_CODE" ? await fetchWahaQrDataUri(waha) : null

  return (
    <div className="grid animate-fade-in-up gap-6">
      <PageHeader
        title="Configurações"
        description="Identidade visual e integrações da clínica."
      />

      <Tabs defaultValue="identidade">
        <TabsList>
          <TabsTrigger value="identidade">Identidade visual</TabsTrigger>
          {canSetAgendaColors ? <TabsTrigger value="agenda">Cores da agenda</TabsTrigger> : null}
          {canManageIntegrations ? (
            <>
              <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
              <TabsTrigger value="avancado">Avançado</TabsTrigger>
            </>
          ) : null}
        </TabsList>

        <TabsContent value="identidade" className="mt-5">
          <BrandingSettings logoUrl={branding.logoUrl} />
        </TabsContent>

        {agendaColors ? (
          <TabsContent value="agenda" className="mt-5">
            <AgendaColorsSettings colors={agendaColors} />
          </TabsContent>
        ) : null}

        {canManageIntegrations && waha && wahaStatus ? (
          <TabsContent value="whatsapp" className="mt-5">
            {/* A chave de API nunca cruza para o cliente — só se existe uma. */}
            <WahaSettings
              enabled={waha.enabled}
              baseUrl={waha.baseUrl}
              session={waha.session}
              hasApiKey={Boolean(waha.apiKey)}
              status={wahaStatus}
              initialQr={wahaQr}
            />
          </TabsContent>
        ) : null}

        {/* n8n em standby: a integração continua funcionando e a configuração preservada,
            mas sai do caminho principal. O envio de WhatsApp passa a ser assunto do WAHA, e
            deixar as duas telas lado a lado faria parecer que é preciso configurar as duas. */}
        {canManageIntegrations && n8n ? (
          <TabsContent value="avancado" className="mt-5">
            <details className="rounded-xl border border-border bg-card px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium">
                Mensageria via n8n (legado)
                <span className="ml-2 text-[0.75rem] font-normal text-muted-foreground">
                  mantida para quem já usa
                </span>
              </summary>
              <div className="mt-4">
                <N8nSettings
                  enabled={n8n.enabled}
                  baseUrl={n8n.baseUrl}
                  path={n8n.path}
                  webhookUrl={n8n.webhookUrl}
                  hasSecret={Boolean(n8n.secret)}
                  channels={n8n.channels}
                />
              </div>
            </details>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  )
}
