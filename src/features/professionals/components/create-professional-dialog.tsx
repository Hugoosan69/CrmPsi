"use client"

import { useActionState, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useCloseOnSuccess } from "@/hooks/use-close-on-success"
import type { Database } from "@/types/supabase"
import { createProfessionalAction, type ProfessionalActionState } from "../actions/professional.actions"
import { ProfessionalFormFields } from "./professional-form-fields"

type Specialty = Pick<Database["public"]["Tables"]["specialties"]["Row"], "id" | "name">

const initialState: ProfessionalActionState = {}

export function CreateProfessionalDialog({ specialties }: { specialties: Specialty[] }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(createProfessionalAction, initialState)

  useCloseOnSuccess(state, Boolean(state.success), () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Novo profissional</Button>} />
      <DialogContent className="max-w-lg">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Novo profissional</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <ProfessionalFormFields specialties={specialties} />
          </div>
          {state.error ? (
            <p className="mb-3 text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
