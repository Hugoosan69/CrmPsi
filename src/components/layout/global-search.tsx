"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, Package, Search, Stethoscope, UserRound } from "lucide-react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { globalSearchAction, type SearchHit, type SearchResults } from "@/features/search/actions/search.actions"

const EMPTY: SearchResults = { patients: [], professionals: [], procedures: [], pages: [] }

/**
 * Search is a product feature, not a page (item 15/33): jump straight to a patient,
 * colleague, procedure or screen from anywhere, with no "open list, find, open" detour.
 * Ctrl/⌘+K opens it without reaching for the mouse, which matters during real reception
 * work.
 *
 * Every group is permission-filtered server-side — the palette must never surface a record
 * or a screen the role cannot open.
 */
export function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResults>(EMPTY)
  const [isPending, startTransition] = useTransition()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const tooShort = query.trim().length < 2

  useEffect(() => {
    clearTimeout(timeoutRef.current)
    if (tooShort) return
    // Debounced so typing a name is one request, not one per keystroke.
    timeoutRef.current = setTimeout(() => {
      startTransition(async () => {
        setResults(await globalSearchAction(query))
      })
    }, 220)
    return () => clearTimeout(timeoutRef.current)
  }, [query, tooShort])

  // Derived rather than cleared in the effect: clearing state synchronously in an effect
  // body triggers a cascading render, and "the query is too short" is a function of the
  // query, not a separate piece of state to keep in sync.
  const visible = tooShort ? EMPTY : results

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  function go(hit: SearchHit) {
    setOpen(false)
    setQuery("")
    setResults(EMPTY)
    router.push(hit.href)
  }

  const groups = [
    { key: "patients", heading: "Pacientes", icon: UserRound, items: visible.patients },
    { key: "professionals", heading: "Profissionais", icon: Stethoscope, items: visible.professionals },
    { key: "procedures", heading: "Procedimentos", icon: Package, items: visible.procedures },
    { key: "pages", heading: "Telas", icon: CalendarDays, items: visible.pages },
  ].filter((group) => group.items.length > 0)

  const total = groups.reduce((sum, g) => sum + g.items.length, 0)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="group flex h-9 w-full max-w-80 items-center gap-2 rounded-lg border border-input bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:border-ring/40 hover:bg-muted/40 focus-visible:border-ring focus-visible:outline-none"
          >
            <Search className="size-4 shrink-0 opacity-70" />
            <span className="truncate">Buscar no sistema</span>
            <kbd className="ml-auto hidden shrink-0 items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground/80 xl:inline-flex">
              Ctrl K
            </kbd>
          </button>
        }
      />
      <PopoverContent className="w-[26rem] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Paciente, profissional, procedimento ou tela..."
            value={query}
            onValueChange={setQuery}
            autoFocus
          />
          <CommandList className="max-h-[22rem]">
            <CommandEmpty>
              {tooShort
                ? "Digite ao menos 2 caracteres"
                : isPending
                  ? "Buscando..."
                  : "Nada encontrado"}
            </CommandEmpty>

            {total > 0 &&
              groups.map((group) => {
                const Icon = group.icon
                return (
                  <CommandGroup key={group.key} heading={group.heading}>
                    {group.items.map((hit) => (
                      <CommandItem
                        key={`${group.key}:${hit.id}`}
                        value={`${group.key}:${hit.id}`}
                        onSelect={() => go(hit)}
                      >
                        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <div className="min-w-0">
                          <p className="truncate">{hit.label}</p>
                          {hit.detail && (
                            <p className="truncate text-xs text-muted-foreground">{hit.detail}</p>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )
              })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
