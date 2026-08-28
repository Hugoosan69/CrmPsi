"use client"

import { usePathname } from "next/navigation"
import { useState } from "react"
import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import type { NavSection } from "@/config/navigation"
import { AppSidebar } from "./app-sidebar"
import { GlobalSearch } from "./global-search"
import { HeaderMessages } from "./header-messages"
import { UserMenu } from "./user-menu"
import { NotificationBell } from "@/features/notifications/components/notification-bell"

type Props = {
  sections: NavSection[]
  clinicName: string
  logoUrl?: string | null
  fullName: string
  avatarUrl?: string | null
  roleName: string
}

function currentTitle(pathname: string, sections: NavSection[]) {
  for (const section of sections) {
    for (const item of section.items) {
      if (pathname === item.href || pathname.startsWith(item.href + "/")) return item.label
    }
  }
  return "CSIB"
}

export function AppHeader({ sections, clinicName,
  logoUrl, fullName, avatarUrl, roleName }: Props) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const title = currentTitle(pathname, sections)

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card/85 px-4 backdrop-blur-md lg:px-6">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        aria-label="Abrir menu"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="size-4" />
      </Button>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-[248px] border-0 p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <AppSidebar
            sections={sections}
            clinicName={clinicName}
            logoUrl={logoUrl}
            fullName={fullName}
            avatarUrl={avatarUrl}
            roleName={roleName}
            collapsed={false}
            variant="mobile"
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <h1 className="min-w-0 truncate font-heading text-[0.95rem] font-semibold lg:hidden">{title}</h1>

      <div className="hidden flex-1 lg:flex">
        <GlobalSearch />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <HeaderMessages />
        <NotificationBell />
        <UserMenu
          fullName={fullName}
          avatarUrl={avatarUrl}
          roleName={roleName}
          clinicName={clinicName}
        />
      </div>
    </header>
  )
}
