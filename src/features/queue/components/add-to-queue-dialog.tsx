"use client"

import { useActionState, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCloseOnSuccess } from "@/hooks/use-close-on-success"
import { PatientCombobox } from "@/features/patients/components/patient-combobox"
import { addWalkInToQueueAction, type AddToQueueState } from "../actions/queue.actions"
import type { ProcedureOption, ProfessionalOption, SpecialtyOption } from "@/types/options"

const initialState: AddToQueueState = {}

export function AddToQueueDialog({
  professionals,
  specialties,
  procedures,
}: {
  professionals: ProfessionalOption[]
  specialties: SpecialtyOption[]
  procedures: ProcedureOption[]
}) {
  const [open, setOpen] = useState(false)
  const [procedureId, setProcedureId] = useState("")
  const [state, formAction, isPending] = useActionState(addWalkInToQueueAction, initialState)
  const queryClient = useQueryClient()

  useCloseOnSuccess(state, Boolean(state.success), () => {
    setOpen(false)
    setProcedureId("")
    queryClient.invalidateQueries({ queryKey: ["queue"] })
  })

  const selectedPrice = procedures.find((p) => p.id === procedureId)?.price ?? null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Encaixe</Button>} />
      <DialogContent className="max-w-md">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Encaixe — paciente sem agendamento</DialogTitle>
            <DialogDescription>
              O paciente entra como <strong>pagamento pendente</strong> e só vai para a fila após o
              pagamento ser confirmado.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label>Paciente</Label>
              <PatientCombobox name="patient_id" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="procedure_id">Procedimento</Label>
              <Select
                name="procedure_id"
                value={procedureId}
                onValueChange={(v) => setProcedureId(v ?? "")}
              >
                <SelectTrigger id="procedure_id" className="w-full">
                  <SelectValue placeholder="Selecione (define o valor)" />
                </SelectTrigger>
                <SelectContent>
                  {procedures.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="amount">Valor a cobrar (R$)</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                min={0.01}
                step="0.01"
                key={procedureId}
                defaultValue={selectedPrice && selectedPrice > 0 ? selectedPrice : undefined}
                placeholder="Informe o valor"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="professional_id">Profissional (opcional)</Label>
              <Select name="professional_id">
                <SelectTrigger id="professional_id" className="w-full">
                  <SelectValue placeholder="Qualquer / a definir" />
                </SelectTrigger>
                <SelectContent>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="specialty_id">Especialidade (opcional)</Label>
              <Select name="specialty_id">
                <SelectTrigger id="specialty_id" className="w-full">
                  <SelectValue placeholder="Não especificar" />
                </SelectTrigger>
                <SelectContent>
                  {specialties.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              {isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
