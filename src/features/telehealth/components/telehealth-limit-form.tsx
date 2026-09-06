"use client"

import { useActionState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  setTelehealthLimitAction,
  type TelehealthActionState,
} from "../actions/telehealth.actions"

const initialState: TelehealthActionState = {}

/** O teto é um aviso, não um bloqueio: o sistema informa, quem decide parar é a clínica. */
export function TelehealthLimitForm({ currentLimit }: { currentLimit: number }) {
  const [state, formAction, isPending] = useActionState(setTelehealthLimitAction, initialState)

  return (
    <form action={formAction} className="grid gap-2 border-t border-border pt-4">
      <Label htmlFor="monthly_minutes">Limite mensal de minutos</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="monthly_minutes"
          name="monthly_minutes"
          type="number"
          min={0}
          step={10}
          defaultValue={currentLimit}
          className="w-40"
        />
        <Button type="submit" variant="outline" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar limite"}
        </Button>
      </div>
      <p className="text-[0.75rem] text-muted-foreground">
        0 não limita. Atingir o teto não impede novas chamadas — o painel passa a avisar, e a
        decisão de parar continua sendo de quem administra a clínica.
      </p>

      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-[0.8rem] text-status-success" role="status">
          Limite atualizado.
        </p>
      )}
    </form>
  )
}
