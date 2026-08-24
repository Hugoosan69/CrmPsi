"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Search } from "lucide-react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { searchPatientsAction } from "@/features/patients/actions/patient.actions"

type PatientOption = { id: string; label: string; detail: string }

/** Item 15/33: search is a product feature, not a page — jump straight to a patient's
 * profile from anywhere, no "open list, find, open profile" detour. Ctrl/⌘+K opens it
 * without reaching for the mouse, which matters during real reception work. */
export function GlobalPatientSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [options, setOptions] = useState<PatientOption[]>([])
  const [isPending, startTransition] = useTransition()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const visibleOptions = query.trim().length < 2 ? [] : options
  const basePath = pathname.startsWith("/profissional") ? "/profissional/pacientes" : "/recepcao/pacientes"

  useEffect(() => {
    clearTimeout(timeoutRef.current)
    if (query.trim().length < 2) return
    timeoutRef.current = setTimeout(() => {
      startTransition(async () => {
        setOptions(await searchPatientsAction(query))
      })
    }, 250)
    return () => clearTimeout(timeoutRef.current)
  }, [query])

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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="group flex h-9 w-full max-w-72 items-center gap-2 rounded-lg border border-input bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:border-ring/40 hover:bg-muted/40 focus-visible:border-ring focus-visible:outline-none"
          >
            <Search className="size-4 shrink-0 opacity-70" />
            <span className="truncate">Buscar paciente</span>
            <kbd className="ml-auto hidden shrink-0 items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground/80 xl:inline-flex">
              Ctrl K
            </kbd>
          </button>
        }
      />
      <PopoverContent className="w-96 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Nome, CPF ou telefone..." value={query} onValueChange={setQuery} autoFocus />
          <CommandList>
            <CommandEmpty>
              {query.trim().length < 2
                ? "Digite ao menos 2 caracteres"
                : isPending
                  ? "Buscando..."
                  : "Nenhum paciente encontrado"}
            </CommandEmpty>
            <CommandGroup>
              {visibleOptions.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  onSelect={() => {
                    setOpen(false)
                    setQuery("")
                    router.push(`${basePath}/${option.id}`)
                  }}
                >
                  <div className="min-w-0">
                    <p className="truncate">{option.label}</p>
                    {option.detail && (
                      <p className="truncate text-xs text-muted-foreground">{option.detail}</p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
