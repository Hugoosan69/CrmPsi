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
import { createTransactionAction, type FinancialActionState } from "../actions/financial.actions"

const initialState: FinancialActionState = {}

export function CreateTransactionDialog({ defaultType = "receita" }: { defaultType?: "receita" | "despesa" }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<"receita" | "despesa">(defaultType)
  const [state, formAction, isPending] = useActionState(createTransactionAction, initialState)

  useCloseOnSuccess(state, Boolean(state.success), () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Novo lançamento</Button>} />
      <DialogContent className="max-w-lg">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Novo lançamento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <input type="hidden" name="type" value={type} />
            <div className="grid gap-1.5">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType((v ?? "receita") as "receita" | "despesa")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {type === "receita" && (
              <div className="grid gap-1.5">
                <Label>Paciente (opcional)</Label>
                <PatientCombobox name="patient_id" />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="category">Categoria</Label>
              <Input id="category" name="category" placeholder="Consulta, aluguel, material..." />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="description">Descrição</Label>
              <Input id="description" name="description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="amount">Valor (R$)</Label>
                <Input id="amount" name="amount" type="number" min={0.01} step="0.01" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="due_date">Vencimento</Label>
                <Input id="due_date" name="due_date" type="date" />
              </div>
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
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
