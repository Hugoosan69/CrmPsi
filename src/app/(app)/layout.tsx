import { requireMembership, hasPermission } from "@/lib/auth/session"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { ConfigurationRequired } from "@/components/shared/configuration-required"
import { AppShell } from "@/components/layout/app-shell"
import { visibleNavSections } from "@/config/navigation"
import { PERMISSIONS } from "@/config/permissions"
import { createClient } from "@/lib/supabase/server"
import { getPublicBranding } from "@/services/clinic-settings.service"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Checked before touching Supabase: without configuration every page below would throw
  // a bare 500, which tells whoever is deploying nothing at all.
  if (!isSupabaseConfigured()) {
    return <ConfigurationRequired />
  }

  const membership = await requireMembership()

  // Mesma marca da tela de login. getPublicBranding devolve null em qualquer falha, e a
  // sidebar cai no SVG embutido — a navegação nunca depende de a logo carregar.
  const branding = await getPublicBranding(await createClient())

  const sections = visibleNavSections((slug) => hasPermission(membership, slug))

  return (
    <AppShell
      sections={sections}
      clinicName={membership.clinicName}
      logoUrl={branding?.logoUrl}
      fullName={membership.fullName}
      avatarUrl={membership.avatarUrl}
      roleName={membership.roleName}
      // Quem ouve o toque de chamada é quem está no balcão — agora dito por uma permissão
      // em vez de deduzido de duas. Era `queue.manage && financial.manage`, uma aproximação
      // que existia só porque não havia como perguntar diretamente: `queue.manage` sozinha
      // incluiria os profissionais, e cada um ouviria o toque quando um colega chamasse um
      // paciente. A área responde a pergunta que aquele AND tentava responder.
      isFrontDesk={hasPermission(membership, PERMISSIONS.RECEPTION_ACCESS)}
    >
      {children}
    </AppShell>
  )
}
