"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { NavSection } from "@/config/navigation"
import { NAV_ICONS } from "./nav-icons"
import { UserAvatar } from "@/components/shared/user-avatar"

const SECTIONS_STORAGE_KEY = "csib.sidebar.closed-sections"

type Props = {
  sections: NavSection[]
  clinicName: string
  /** Logo configurada pela clínica; ausente cai no SVG embutido. */
  logoUrl?: string | null
  fullName: string
  avatarUrl?: string | null
  roleName: string
  collapsed: boolean
  onToggleCollapsed?: () => void
  /** Mobile drawer variant: no collapse toggle, fills the sheet. */
  variant?: "desktop" | "mobile"
  onNavigate?: () => void
}

export function AppSidebar({
  sections,
  clinicName,
  logoUrl,
  fullName,
  avatarUrl,
  roleName,
  collapsed,
  onToggleCollapsed,
  variant = "desktop",
  onNavigate,
}: Props) {
  const pathname = usePathname()

  // Guarda as seções FECHADAS, não as abertas: uma seção nova que apareça depois (por
  // permissão concedida ou feature adicionada) nasce visível, em vez de sumir porque não
  // estava na lista salva.
  const [closedSections, setClosedSections] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Deferida, pelo mesmo motivo da preferência de recolhimento em app-shell.tsx: só dá
    // para ler no cliente, então o render do servidor mostra tudo aberto e isto corrige
    // logo depois, num tique só do navegador.
    const id = setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(SECTIONS_STORAGE_KEY)
        if (raw) setClosedSections(new Set(JSON.parse(raw) as string[]))
      } catch {
        // Preferência de layout: se o armazenamento falhar, abrir tudo é o padrão seguro.
      }
    }, 0)
    return () => clearTimeout(id)
  }, [])

  function toggleSection(title: string) {
    setClosedSections((prev) => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      try {
        window.localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify([...next]))
      } catch {
        // Sem persistência a seção ainda recolhe nesta sessão.
      }
      return next
    })
  }

  /** A seção da página atual nunca fica fechada — senão o item ativo ficaria escondido e
   *  pareceria que a navegação sumiu. */
  function isSectionClosed(title: string) {
    if (!closedSections.has(title)) return false
    const section = sections.find((s) => s.title === title)
    return !section?.items.some(
      (item) => pathname === item.href || pathname.startsWith(item.href + "/")
    )
  }
  const isCollapsed = variant === "desktop" && collapsed

  // Width is set inline rather than through width utilities on purpose: as a flex item
  // the sidebar's default `min-width: auto` refuses to shrink below the intrinsic width
  // of its own nowrap content, so a width class alone silently does nothing. Pinning
  // width AND minWidth together is what actually collapses it.
  const widthStyle =
    variant === "desktop" ? { width: isCollapsed ? 68 : 248, minWidth: isCollapsed ? 68 : 248 } : undefined

  /**
   * Recolhida, a barra inteira vira alvo de clique para expandir.
   *
   * O botão de alternar é pequeno e fica no rodapé; recolhida, a barra é uma faixa estreita
   * de ícones e a intenção óbvia de quem clica nela é abri-la. Só vale no sentido de abrir —
   * transformar a barra aberta num alvo de fechar faria cada clique perdido entre dois itens
   * recolher a navegação.
   */
  const expandOnClick =
    isCollapsed && onToggleCollapsed
      ? {
          onClick: (event: React.MouseEvent<HTMLElement>) => {
            // Só quando o clique não pegou um link ou botão — senão navegar também expandiria.
            if ((event.target as HTMLElement).closest("a,button")) return
            onToggleCollapsed()
          },
        }
      : {}

  return (
    <aside
      style={widthStyle}
      {...expandOnClick}
      title={isCollapsed && onToggleCollapsed ? "Clique para expandir o menu" : undefined}
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        "transition-[width,min-width] duration-200 ease-out",
        variant === "mobile" && "w-full",
        isCollapsed && onToggleCollapsed && "cursor-e-resize"
      )}
    >
      {/* Brand lockup */}
      <div
        className={cn(
          "flex h-14 items-center gap-2.5 px-4",
          isCollapsed && "justify-center px-0"
        )}
      >
        {/* Mesma logo da tela de login: quem trocou a marca em Gestão espera vê-la aqui
            também. next/image não serve para a URL enviada pelo operador — ela pode apontar
            para qualquer host, o que exigiria remotePatterns para cada um. */}
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="size-[30px] shrink-0 rounded-md object-contain" />
        ) : (
          <Image src="/branding/csib-logo.svg" alt="" width={30} height={30} className="shrink-0" />
        )}
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
                <button
                  type="button"
                  onClick={() => toggleSection(section.title)}
                  aria-expanded={!isSectionClosed(section.title)}
                  className="mb-1 flex w-full items-center gap-1 rounded-md px-2.5 py-1 text-[0.66rem] font-semibold tracking-[0.1em] text-muted-foreground/70 transition-colors hover:text-sidebar-accent-foreground"
                >
                  <ChevronRight
                    className={cn(
                      "size-3 shrink-0 transition-transform duration-150",
                      !isSectionClosed(section.title) && "rotate-90"
                    )}
                    aria-hidden
                  />
                  {section.title.toUpperCase()}
                </button>
              ) : (
                <div className="mx-auto mb-2 h-px w-6 bg-sidebar-border" aria-hidden />
              )}
              {/* Recolhido só esconde os rótulos; nesse modo a lista continua visível,
                  senão a barra estreita ficaria só de ícones de seta. */}
              <ul className={cn("grid gap-px", !isCollapsed && isSectionClosed(section.title) && "hidden")}>
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
        <UserAvatar src={avatarUrl} name={fullName} />
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
