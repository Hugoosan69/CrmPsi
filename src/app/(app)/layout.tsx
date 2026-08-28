import { requireMembership, hasPermission } from "@/lib/auth/session"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { ConfigurationRequired } from "@/components/shared/configuration-required"
import { AppShell } from "@/components/layout/app-shell"
import { NAV_SECTIONS } from "@/config/navigation"
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

  const sections = NAV_SECTIONS.map((section) => ({
    title: section.title,
    items: section.items.filter(
      (item) => item.permission === null || hasPermission(membership, item.permission)
    ),
  }))

  return (
    <AppShell
      sections={sections}
      clinicName={membership.clinicName}
      logoUrl={branding?.logoUrl}
      fullName={membership.fullName}
      avatarUrl={membership.avatarUrl}
      roleName={membership.roleName}
    >
      {children}
    </AppShell>
  )
}
