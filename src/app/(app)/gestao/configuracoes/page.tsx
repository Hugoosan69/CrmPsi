import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { getClinicBranding, getN8nIntegration } from "@/services/clinic-settings.service"
import { getWahaConfig, getWahaStatus } from "@/services/waha.service"
import { PageHeader } from "@/components/shared/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BrandingSettings } from "@/features/settings/components/branding-settings"
import { N8nSettings } from "@/features/settings/components/n8n-settings"
import { WahaSettings } from "@/features/settings/components/waha-settings"

export default async function ConfiguracoesPage() {
  const membership = await requirePermission(PERMISSIONS.SETTINGS_MANAGE)
  const supabase = await createClient()

  const [branding, n8n, waha] = await Promise.all([
    getClinicBranding(supabase, membership.clinicId),
    getN8nIntegration(supabase, membership.clinicId),
    getWahaConfig(supabase, membership.clinicId),
  ])

  // Consultado no servidor a cada carga: o estado da sessão do WhatsApp muda por fora do
  // sistema (o dono desvincula o aparelho, a VPS reinicia), então guardá-lo mostraria uma
  // conexão que já caiu.
  const wahaStatus = await getWahaStatus(waha)

  return (
    <div className="grid animate-fade-in-up gap-6">
      <PageHeader
        title="Configurações"
        description="Identidade visual e integrações da clínica."
      />

      <Tabs defaultValue="identidade">
        <TabsList>
          <TabsTrigger value="identidade">Identidade visual</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="avancado">Avançado</TabsTrigger>
        </TabsList>

        <TabsContent value="identidade" className="mt-5">
          <BrandingSettings logoUrl={branding.logoUrl} />
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-5">
          {/* A chave de API nunca cruza para o cliente — só se existe uma. */}
          <WahaSettings
            enabled={waha.enabled}
            baseUrl={waha.baseUrl}
            session={waha.session}
            hasApiKey={Boolean(waha.apiKey)}
            status={wahaStatus}
          />
        </TabsContent>

        {/* n8n em standby: a integração continua funcionando e a configuração preservada,
            mas sai do caminho principal. O envio de WhatsApp passa a ser assunto do WAHA, e
            deixar as duas telas lado a lado faria parecer que é preciso configurar as duas. */}
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
      </Tabs>
    </div>
  )
}
