"use client"

import { useEffect, useRef, useState, useTransition } from "react"

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
import { searchCidAction } from "../actions/record.actions"

type CidOption = { code: string; description: string }

export function CidCombobox({ onSelect }: { onSelect: (option: CidOption) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [options, setOptions] = useState<CidOption[]>([])
  const [isPending, startTransition] = useTransition()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const visibleOptions = query.trim().length < 2 ? [] : options

  useEffect(() => {
    clearTimeout(timeoutRef.current)
    if (query.trim().length < 2) return
    timeoutRef.current = setTimeout(() => {
      startTransition(async () => {
        setOptions(await searchCidAction(query))
      })
    }, 250)
    return () => clearTimeout(timeoutRef.current)
  }, [query])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline">Adicionar CID</Button>} />
      <PopoverContent className="w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar CID por código ou descrição..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>
              {query.trim().length < 2 ? "Digite ao menos 2 caracteres" : isPending ? "Buscando..." : "Nenhum CID encontrado"}
            </CommandEmpty>
            <CommandGroup>
              {visibleOptions.map((option) => (
                <CommandItem
                  key={option.code}
                  value={option.code}
                  onSelect={() => {
                    onSelect(option)
                    setOpen(false)
                    setQuery("")
                  }}
                >
                  <span className="font-mono text-xs">{option.code}</span>
                  <span className="ml-2">{option.description}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
