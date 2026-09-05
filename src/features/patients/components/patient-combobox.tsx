"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { searchPatientsAction } from "../actions/patient.actions"

type PatientOption = { id: string; label: string; detail: string }

/** Reusable "PatientSearch" (item 26) — search-as-you-type patient picker for any form
 * that needs to reference an existing patient (agenda, fila) without leaving the dialog. */
export function PatientCombobox({
  name,
  defaultValue,
  placeholder = "Buscar paciente por nome, CPF ou telefone...",
  onSelect,
}: {
  name: string
  defaultValue?: { id: string; label: string }
  placeholder?: string
  /** Chamado com o id do paciente escolhido — usado por formulários que precisam reagir
   * à escolha (ex.: agendamento, para sugerir sessões de pacote ativas). */
  onSelect?: (patientId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [options, setOptions] = useState<PatientOption[]>([])
  const [selected, setSelected] = useState<PatientOption | null>(
    defaultValue ? { ...defaultValue, detail: "" } : null
  )
  const [isPending, startTransition] = useTransition()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const visibleOptions = query.trim().length < 2 ? [] : options

  useEffect(() => {
    clearTimeout(timeoutRef.current)
    if (query.trim().length < 2) {
      return
    }
    timeoutRef.current = setTimeout(() => {
      startTransition(async () => {
        const results = await searchPatientsAction(query)
        setOptions(results)
      })
    }, 250)
    return () => clearTimeout(timeoutRef.current)
  }, [query])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <input type="hidden" name={name} value={selected?.id ?? ""} />
      <PopoverTrigger
        render={
          <Button variant="outline" className="w-full justify-between font-normal">
            <span className={cn(!selected && "text-muted-foreground")}>
              {selected ? selected.label : "Selecione um paciente"}
            </span>
            <ChevronsUpDown className="size-4 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-[--anchor-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
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
                    setSelected(option)
                    setOpen(false)
                    onSelect?.(option.id)
                  }}
                >
                  <Check
                    className={cn("mr-2 size-4", selected?.id === option.id ? "opacity-100" : "opacity-0")}
                  />
                  <div>
                    <p>{option.label}</p>
                    {option.detail && <p className="text-xs text-muted-foreground">{option.detail}</p>}
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
