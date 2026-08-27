import { requireMembership, hasPermission } from "@/lib/auth/session"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { ConfigurationRequired } from "@/components/shared/configuration-required"
import { AppShell } from "@/components/layout/app-shell"
import { NAV_SECTIONS } from "@/config/navigation"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Checked before touching Supabase: without configuration every page below would throw
  // a bare 500, which tells whoever is deploying nothing at all.
  if (!isSupabaseConfigured()) {
    return <ConfigurationRequired />
  }

  const membership = await requireMembership()

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
      fullName={membership.fullName}
      roleName={membership.roleName}
    >
      {children}
    </AppShell>
  )
}
