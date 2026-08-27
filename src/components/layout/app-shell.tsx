"use client"

import { useEffect, useState } from "react"

import type { NavSection } from "@/config/navigation"
import { AppHeader } from "./app-header"
import { AppSidebar } from "./app-sidebar"

const COLLAPSE_STORAGE_KEY = "csib:sidebar-collapsed"

type Props = {
  sections: NavSection[]
  clinicName: string
  fullName: string
  roleName: string
  children: React.ReactNode
}

export function AppShell({ sections, clinicName, fullName, roleName, children }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    // Deferred via setTimeout (not called synchronously in the effect body): the
    // stored preference can only be read client-side, so the server-rendered pass is
    // always "expanded" and this corrects it right after mount, in a browser-only tick.
    const id = setTimeout(() => {
      setCollapsed(window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1")
    }, 0)
    return () => clearTimeout(id)
  }, [])

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0")
      return next
    })
  }

  return (
    <div className="flex min-h-screen">
      {/* Sticky full-height chrome so long tables scroll inside the content column
          instead of dragging the navigation off-screen. */}
      <div className="sticky top-0 hidden h-screen lg:flex">
        <AppSidebar
          sections={sections}
          clinicName={clinicName}
          fullName={fullName}
          roleName={roleName}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          sections={sections}
          clinicName={clinicName}
          fullName={fullName}
          roleName={roleName}
        />
        <main className="flex-1 px-4 py-5 lg:px-7 lg:py-6">
          {/* Capped measure: on ultrawide monitors an uncapped table stretches to
              unreadable line lengths, while the clinic's laptops still fill the width. */}
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
