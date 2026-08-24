"use client"

import { useActionState, useState } from "react"
import { Plus, Trash2 } from "lucide-react"

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
import { Textarea } from "@/components/ui/textarea"
import { useCloseOnSuccess } from "@/hooks/use-close-on-success"
import type { PrescriptionItemInput } from "@/schemas/prescription.schema"
import { createPrescriptionAction, type PrescriptionActionState } from "../actions/prescription.actions"

const emptyItem: PrescriptionItemInput = {
  medication_name: "",
  concentration: "",
  pharmaceutical_form: "",
  dose: "",
  frequency: "",
  duration: "",
  quantity: "",
  instructions: "",
}

const initialState: PrescriptionActionState = {}

export function PrescriptionBuilder({
  patientId,
  professionalId,
  medicalRecordId,
  queueEntryId,
}: {
  patientId: string
  professionalId: string
  medicalRecordId: string | null
  queueEntryId?: string
}) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<PrescriptionItemInput[]>([{ ...emptyItem }])
  const action = createPrescriptionAction.bind(null, { patientId, professionalId, medicalRecordId, queueEntryId })
  const [state, formAction, isPending] = useActionState(action, initialState)

  useCloseOnSuccess(state, Boolean(state.success), () => {
    setOpen(false)
    setItems([{ ...emptyItem }])
  })

  function updateItem(index: number, field: keyof PrescriptionItemInput, value: string) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Emitir prescrição</Button>} />
      <DialogContent className="max-w-2xl">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Emitir prescrição</DialogTitle>
          </DialogHeader>
          <input type="hidden" name="items_json" value={JSON.stringify(items)} />
          <div className="grid max-h-[60vh] gap-4 overflow-y-auto py-4">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-6 gap-2 rounded-lg border p-3">
                <div className="col-span-6 grid gap-1">
                  <Label>Medicamento</Label>
                  <Input
                    value={item.medication_name}
                    onChange={(e) => updateItem(index, "medication_name", e.target.value)}
                    required
                  />
                </div>
                <div className="col-span-2 grid gap-1">
                  <Label>Concentração</Label>
                  <Input value={item.concentration} onChange={(e) => updateItem(index, "concentration", e.target.value)} />
                </div>
                <div className="col-span-2 grid gap-1">
                  <Label>Forma farmacêutica</Label>
                  <Input
                    value={item.pharmaceutical_form}
                    onChange={(e) => updateItem(index, "pharmaceutical_form", e.target.value)}
                  />
                </div>
                <div className="col-span-2 grid gap-1">
                  <Label>Dose</Label>
                  <Input value={item.dose} onChange={(e) => updateItem(index, "dose", e.target.value)} />
                </div>
                <div className="col-span-2 grid gap-1">
                  <Label>Frequência</Label>
                  <Input value={item.frequency} onChange={(e) => updateItem(index, "frequency", e.target.value)} />
                </div>
                <div className="col-span-2 grid gap-1">
                  <Label>Duração</Label>
                  <Input value={item.duration} onChange={(e) => updateItem(index, "duration", e.target.value)} />
                </div>
                <div className="col-span-2 grid gap-1">
                  <Label>Quantidade</Label>
                  <Input value={item.quantity} onChange={(e) => updateItem(index, "quantity", e.target.value)} />
                </div>
                <div className="col-span-6 grid gap-1">
                  <Label>Instruções</Label>
                  <Input value={item.instructions} onChange={(e) => updateItem(index, "instructions", e.target.value)} />
                </div>
                {items.length > 1 && (
                  <div className="col-span-6 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="size-4" /> Remover
                    </Button>
                  </div>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, { ...emptyItem }])}>
              <Plus className="size-4" /> Adicionar medicamento
            </Button>
            <div className="grid gap-1.5">
              <Label htmlFor="notes">Observações da prescrição</Label>
              <Textarea id="notes" name="notes" rows={2} />
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
              {isPending ? "Emitindo..." : "Emitir"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
