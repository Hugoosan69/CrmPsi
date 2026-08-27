"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { NavSection } from "@/config/navigation"
import { NAV_ICONS } from "./nav-icons"

type Props = {
  sections: NavSection[]
  clinicName: string
  fullName: string
  roleName: string
  collapsed: boolean
  onToggleCollapsed?: () => void
  /** Mobile drawer variant: no collapse toggle, fills the sheet. */
  variant?: "desktop" | "mobile"
  onNavigate?: () => void
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""
  return (first + last).toUpperCase()
}

export function AppSidebar({
  sections,
  clinicName,
  fullName,
  roleName,
  collapsed,
  onToggleCollapsed,
  variant = "desktop",
  onNavigate,
}: Props) {
  const pathname = usePathname()
  const isCollapsed = variant === "desktop" && collapsed

  // Width is set inline rather than through width utilities on purpose: as a flex item
  // the sidebar's default `min-width: auto` refuses to shrink below the intrinsic width
  // of its own nowrap content, so a width class alone silently does nothing. Pinning
  // width AND minWidth together is what actually collapses it.
  const widthStyle =
    variant === "desktop" ? { width: isCollapsed ? 68 : 248, minWidth: isCollapsed ? 68 : 248 } : undefined

  return (
    <aside
      style={widthStyle}
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        "transition-[width,min-width] duration-200 ease-out",
        variant === "mobile" && "w-full"
      )}
    >
      {/* Brand lockup */}
      <div
        className={cn(
          "flex h-14 items-center gap-2.5 px-4",
          isCollapsed && "justify-center px-0"
        )}
      >
        <Image src="/branding/csib-logo.svg" alt="" width={30} height={30} className="shrink-0" />
        {!isCollapsed && (
          <div className="min-w-0 leading-none">
            <p className="font-heading text-[0.98rem] font-semibold">CSIB</p>
            <p className="mt-1 truncate text-[0.68rem] text-muted-foreground">{clinicName}</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 pb-2">
        {sections
          .filter((section) => section.items.length > 0)
          .map((section) => (
            <div key={section.title} className="mb-4">
              {!isCollapsed ? (
                <p className="mb-1 px-2.5 text-[0.66rem] font-semibold tracking-[0.1em] text-muted-foreground/70">
                  {section.title.toUpperCase()}
                </p>
              ) : (
                <div className="mx-auto mb-2 h-px w-6 bg-sidebar-border" aria-hidden />
              )}
              <ul className="grid gap-px">
                {section.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/")
                  const Icon = NAV_ICONS[item.href]
                  const link = (
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.845rem] transition-colors duration-150",
                        isCollapsed && "justify-center px-0",
                        active
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      {Icon && (
                        <Icon
                          className={cn(
                            "size-[1.05rem] shrink-0 transition-colors",
                            active
                              ? "text-sidebar-primary"
                              : "text-muted-foreground/70 group-hover:text-sidebar-accent-foreground"
                          )}
                          aria-hidden
                        />
                      )}
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  )

                  return (
                    <li key={item.href}>
                      {isCollapsed ? (
                        <Tooltip>
                          <TooltipTrigger render={link} />
                          <TooltipContent side="right">{item.label}</TooltipContent>
                        </Tooltip>
                      ) : (
                        link
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
      </nav>

      {/* Account row */}
      <div
        className={cn(
          "flex items-center gap-2.5 border-t border-sidebar-border px-3 py-3",
          isCollapsed && "justify-center px-0"
        )}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[0.7rem] font-semibold text-secondary-foreground">
          {initials(fullName)}
        </div>
        {!isCollapsed && (
          <>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[0.82rem] font-medium">{fullName}</p>
              <p className="truncate text-[0.7rem] text-muted-foreground">{roleName}</p>
            </div>
          </>
        )}
      </div>

      {variant === "desktop" && onToggleCollapsed && (
        <div
          className={cn(
            "flex border-t border-sidebar-border px-3 py-2",
            isCollapsed ? "justify-center px-0" : "justify-end"
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onToggleCollapsed}
            className="text-muted-foreground hover:text-foreground"
            aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </Button>
        </div>
      )}
    </aside>
  )
}
