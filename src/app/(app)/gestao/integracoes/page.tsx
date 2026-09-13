import { requireAreaAccess } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { CANONICAL_ORIGIN } from "@/config/site"
import { getN8nIntegration } from "@/services/clinic-settings.service"
import { getWahaConfig, getWahaStatus } from "@/services/waha.service"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { N8nSettings } from "@/features/settings/components/n8n-settings"
import { WahaServerSettings } from "@/features/settings/components/waha-server-settings"

/**
 * Infraestrutura de mensageria: servidor do WhatsApp e automações no n8n.
 *
 * Página própria, e não mais uma aba de Configurações, porque o que se edita aqui dá
 * controle total da conta de WhatsApp da clínica e do destino das mensagens. Exige
 * `integrations.manage` — só o proprietário. O vínculo do número (ler QR) ficou em
 * Configurações › WhatsApp, com `whatsapp.connect` (migration 034).
 */
export default async function IntegracoesPage() {
  const membership = await requireAreaAccess(
    PERMISSIONS.MANAGEMENT_ACCESS,
    PERMISSIONS.INTEGRATIONS_MANAGE
  )
  const supabase = await createClient()

  const [waha, n8n] = await Promise.all([
    getWahaConfig(supabase, membership.clinicId),
    getN8nIntegration(supabase, membership.clinicId),
  ])

  // Só a alcançabilidade interessa aqui; o pareamento é assunto da outra tela.
  const wahaStatus = waha.baseUrl ? await getWahaStatus(waha) : null

  // Os endereços que o workflow do n8n chama. Derivados do domínio canônico para não
  // divergirem do que o proxy aceita — um host diferente cairia num redirecionamento 308, e
  // o n8n não segue redirecionamento de POST.
  const outboxUrl = `${CANONICAL_ORIGIN}/api/integrations/outbox`
  const closuresUrl = `${CANONICAL_ORIGIN}/api/integrations/pending-closures`

  return (
    <div className="grid animate-fade-in-up gap-6">
      <PageHeader
        title="Integrações"
        description="Servidor do WhatsApp e automações no n8n. Só quem responde pela conta da clínica tem acesso."
      />

      <WahaServerSettings
        enabled={waha.enabled}
        baseUrl={waha.baseUrl}
        session={waha.session}
        hasApiKey={Boolean(waha.apiKey)}
        status={wahaStatus}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Endereços para o workflow do n8n</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-[0.85rem]">
          <p className="text-muted-foreground">
            O n8n chama estes endereços com o cabeçalho{" "}
            <code className="font-mono">X-CSIB-Token</code> igual ao token da integração abaixo.
          </p>
          <div className="grid gap-1">
            <p className="font-medium">Fila de mensagens — a cada 5 minutos</p>
            <code className="block overflow-x-auto rounded bg-muted px-2 py-1.5 font-mono text-[0.78rem]">
              {outboxUrl}
            </code>
            <p className="text-[0.75rem] text-muted-foreground">
              GET busca o que venceu; POST reporta o resultado. Reportar é obrigatório: sem o
              reporte, a mesma mensagem sai de novo na varredura seguinte.
            </p>
          </div>
          <div className="grid gap-1">
            <p className="font-medium">Fechamentos pendentes — uma vez por dia</p>
            <code className="block overflow-x-auto rounded bg-muted px-2 py-1.5 font-mono text-[0.78rem]">
              {closuresUrl}
            </code>
            <p className="text-[0.75rem] text-muted-foreground">
              POST, sem corpo. Avisa cada profissional com consultas passadas sem fechamento.
            </p>
          </div>
        </CardContent>
      </Card>

      <N8nSettings
        enabled={n8n.enabled}
        baseUrl={n8n.baseUrl}
        path={n8n.path}
        webhookUrl={n8n.webhookUrl}
        hasSecret={Boolean(n8n.secret)}
        channels={n8n.channels}
      />
    </div>
  )
}
