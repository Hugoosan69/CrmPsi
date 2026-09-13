import { hasPermission, requireAreaAccess } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { getAgendaStatusColors, getClinicBranding } from "@/services/clinic-settings.service"
import { fetchWahaQrDataUri, getWahaConfig, getWahaStatus } from "@/services/waha.service"
import { PageHeader } from "@/components/shared/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AgendaColorsSettings } from "@/features/settings/components/agenda-colors-settings"
import { BrandingSettings } from "@/features/settings/components/branding-settings"
import { WahaConnection } from "@/features/settings/components/waha-connection"
import { TelehealthUsagePanel } from "@/features/telehealth/components/telehealth-usage-panel"

/**
 * Configurações do dia a dia: identidade visual, cores da agenda, teleconsulta e o vínculo
 * do número de WhatsApp.
 *
 * O que NÃO está aqui é infraestrutura — endereço do servidor WAHA, sessão, chave de API,
 * n8n. Isso mora em Gestão › Integrações, com `integrations.manage` (migration 034). A
 * separação é de segurança: quem relê o QR depois de uma queda da sessão não precisa, e não
 * deve, ver ou editar a chave que controla a conta de WhatsApp da clínica.
 *
 * Cada aba tem a sua permissão, e a página abre para quem tiver qualquer uma delas.
 */
export default async function ConfiguracoesPage() {
  const membership = await requireAreaAccess(PERMISSIONS.MANAGEMENT_ACCESS, [
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.AGENDA_APPEARANCE,
    PERMISSIONS.WHATSAPP_CONNECT,
  ])
  const supabase = await createClient()

  const canBranding = hasPermission(membership, PERMISSIONS.SETTINGS_MANAGE)
  // Cores da agenda têm permissão própria (migrations/021): mexer na leitura da tela em que
  // a equipe trabalha o dia inteiro é decisão à parte de trocar a logo.
  const canSetAgendaColors = hasPermission(membership, PERMISSIONS.AGENDA_APPEARANCE)
  const canConnectWhatsapp = hasPermission(membership, PERMISSIONS.WHATSAPP_CONNECT)

  const [branding, agendaColors, waha] = await Promise.all([
    canBranding ? getClinicBranding(supabase, membership.clinicId) : Promise.resolve(null),
    canSetAgendaColors
      ? getAgendaStatusColors(supabase, membership.clinicId)
      : Promise.resolve(null),
    canConnectWhatsapp ? getWahaConfig(supabase, membership.clinicId) : Promise.resolve(null),
  ])

  // A configuração do WAHA é lida no servidor só para falar com ele; ao componente vão
  // apenas o estado da sessão e o QR. Endereço, sessão e chave não cruzam para o cliente.
  const wahaConfigured = Boolean(waha?.enabled && waha.baseUrl)
  // Consultado a cada carga: a sessão muda por fora do sistema (o dono desvincula o
  // aparelho, o servidor reinicia), e guardá-la mostraria uma conexão que já caiu.
  const wahaStatus = waha && wahaConfigured ? await getWahaStatus(waha) : null
  const wahaQr =
    waha && wahaStatus?.status === "SCAN_QR_CODE" ? await fetchWahaQrDataUri(waha) : null

  const abaInicial = canBranding ? "identidade" : canSetAgendaColors ? "agenda" : "whatsapp"

  return (
    <div className="grid animate-fade-in-up gap-6">
      <PageHeader
        title="Configurações"
        description="Identidade visual, agenda, teleconsulta e o número de WhatsApp da clínica."
      />

      <Tabs defaultValue={abaInicial}>
        <TabsList>
          {canBranding ? <TabsTrigger value="identidade">Identidade visual</TabsTrigger> : null}
          {canSetAgendaColors ? <TabsTrigger value="agenda">Cores da agenda</TabsTrigger> : null}
          {canBranding ? <TabsTrigger value="teleconsulta">Teleconsulta</TabsTrigger> : null}
          {canConnectWhatsapp ? <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger> : null}
        </TabsList>

        {branding ? (
          <TabsContent value="identidade" className="mt-5">
            <BrandingSettings logoUrl={branding.logoUrl} />
          </TabsContent>
        ) : null}

        {agendaColors ? (
          <TabsContent value="agenda" className="mt-5">
            <AgendaColorsSettings colors={agendaColors} />
          </TabsContent>
        ) : null}

        {canBranding ? (
          <TabsContent value="teleconsulta" className="mt-5">
            <TelehealthUsagePanel />
          </TabsContent>
        ) : null}

        {canConnectWhatsapp ? (
          <TabsContent value="whatsapp" className="mt-5">
            <WahaConnection configured={wahaConfigured} status={wahaStatus} initialQr={wahaQr} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  )
}
