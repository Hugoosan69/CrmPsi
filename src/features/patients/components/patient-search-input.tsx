"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { Input } from "@/components/ui/input"

export function PatientSearchInput() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(searchParams.get("busca") ?? "")
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current)
  }, [])

  return (
    <Input
      placeholder="Buscar por nome, CPF, telefone ou WhatsApp..."
      value={value}
      onChange={(e) => {
        const next = e.target.value
        setValue(next)
        clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
          const params = new URLSearchParams(searchParams)
          if (next) params.set("busca", next)
          else params.delete("busca")
          router.replace(`${pathname}?${params.toString()}`)
        }, 250)
      }}
      className="max-w-sm"
    />
  )
}
