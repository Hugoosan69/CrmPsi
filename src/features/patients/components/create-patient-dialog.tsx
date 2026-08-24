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

import { createPatientAction, type PatientActionState } from "../actions/patient.actions"
import { PatientFormFields } from "./patient-form-fields"

const initialState: PatientActionState = {}

export function CreatePatientDialog() {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(createPatientAction, initialState)

  useCloseOnSuccess(state, Boolean(state.patientId), () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Novo paciente</Button>} />
      <DialogContent className="max-w-lg">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Novo paciente</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <PatientFormFields />
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
