"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { todaySaoPauloDate } from "@/utils/datetime"

function addDays(date: string, delta: number) {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + delta)
  return d.toISOString().slice(0, 10)
}

export function DateNav({ date }: { date: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function goTo(next: string) {
    const params = new URLSearchParams(searchParams)
    params.set("data", next)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => goTo(addDays(date, -1))}>
        ← Anterior
      </Button>
      <Button variant="outline" size="sm" onClick={() => goTo(todaySaoPauloDate())}>
        Hoje
      </Button>
      <Button variant="outline" size="sm" onClick={() => goTo(addDays(date, 1))}>
        Próximo →
      </Button>
      <Input
        type="date"
        value={date}
        onChange={(e) => e.target.value && goTo(e.target.value)}
        className="w-40"
      />
    </div>
  )
}
