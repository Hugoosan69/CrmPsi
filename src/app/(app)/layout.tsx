import { requireMembership, hasPermission } from "@/lib/auth/session"
import { AppShell } from "@/components/layout/app-shell"
import { NAV_SECTIONS } from "@/config/navigation"
import { PERMISSIONS } from "@/config/permissions"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
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
      canSeePatients={hasPermission(membership, PERMISSIONS.PATIENTS_VIEW)}
    >
      {children}
    </AppShell>
  )
}
