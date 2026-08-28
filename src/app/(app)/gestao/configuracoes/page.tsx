import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { getClinicBranding, getN8nIntegration } from "@/services/clinic-settings.service"
import { PageHeader } from "@/components/shared/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BrandingSettings } from "@/features/settings/components/branding-settings"
import { N8nSettings } from "@/features/settings/components/n8n-settings"

export default async function ConfiguracoesPage() {
  const membership = await requirePermission(PERMISSIONS.SETTINGS_MANAGE)
  const supabase = await createClient()

  const [branding, n8n] = await Promise.all([
    getClinicBranding(supabase, membership.clinicId),
    getN8nIntegration(supabase, membership.clinicId),
  ])

  return (
    <div className="grid animate-fade-in-up gap-6">
      <PageHeader
        title="Configurações"
        description="Identidade visual e integrações da clínica."
      />

      <Tabs defaultValue="identidade">
        <TabsList>
          <TabsTrigger value="identidade">Identidade visual</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
        </TabsList>

        <TabsContent value="identidade" className="mt-5">
          <BrandingSettings logoUrl={branding.logoUrl} />
        </TabsContent>

        <TabsContent value="integracoes" className="mt-5">
          {/* The stored token never crosses to the client — only whether one exists. */}
          <N8nSettings
            enabled={n8n.enabled}
            baseUrl={n8n.baseUrl}
            path={n8n.path}
            webhookUrl={n8n.webhookUrl}
            hasSecret={Boolean(n8n.secret)}
            channels={n8n.channels}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
