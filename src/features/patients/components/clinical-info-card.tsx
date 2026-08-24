"use client"

import { useActionState, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import type { Database } from "@/types/supabase"
import {
  updateClinicalInfoAction,
  type ClinicalInfoActionState,
} from "../actions/clinical-info.actions"

type ClinicalInfo = Database["public"]["Tables"]["patient_clinical_info"]["Row"] | null

const initialState: ClinicalInfoActionState = {}

function TagList({ items }: { items: string[] | null | undefined }) {
  if (!items || items.length === 0) return <span className="text-muted-foreground">Nenhuma</span>
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span key={item} className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
          {item}
        </span>
      ))}
    </div>
  )
}

export function ClinicalInfoCard({
  patientId,
  info,
  canEdit,
}: {
  patientId: string
  info: ClinicalInfo
  canEdit: boolean
}) {
  const [open, setOpen] = useState(false)
  const action = updateClinicalInfoAction.bind(null, patientId)
  const [state, formAction, isPending] = useActionState(action, initialState)

  useCloseOnSuccess(state, Boolean(state.success), () => setOpen(false))

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Informações clínicas</CardTitle>
        {canEdit && (
          <Dialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next)
            }}
          >
            <DialogTrigger render={<Button variant="outline" size="sm">Editar</Button>} />
            <DialogContent className="max-w-lg">
              <form action={formAction}>
                <DialogHeader>
                  <DialogTitle>Informações clínicas</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="allergies">Alergias (separadas por vírgula)</Label>
                    <Input id="allergies" name="allergies" defaultValue={info?.allergies?.join(", ") ?? ""} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="chronic_conditions">Condições crônicas (separadas por vírgula)</Label>
                    <Input
                      id="chronic_conditions"
                      name="chronic_conditions"
                      defaultValue={info?.chronic_conditions?.join(", ") ?? ""}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="current_medications">Medicamentos em uso (separados por vírgula)</Label>
                    <Input
                      id="current_medications"
                      name="current_medications"
                      defaultValue={info?.current_medications?.join(", ") ?? ""}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="relevant_history">Histórico relevante</Label>
                    <Textarea
                      id="relevant_history"
                      name="relevant_history"
                      rows={3}
                      defaultValue={info?.relevant_history ?? ""}
                    />
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
        )}
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div>
          <p className="mb-1 font-medium">Alergias</p>
          <TagList items={info?.allergies} />
        </div>
        <div>
          <p className="mb-1 font-medium">Condições crônicas</p>
          <TagList items={info?.chronic_conditions} />
        </div>
        <div>
          <p className="mb-1 font-medium">Medicamentos em uso</p>
          <TagList items={info?.current_medications} />
        </div>
        {info?.relevant_history && (
          <div>
            <p className="mb-1 font-medium">Histórico relevante</p>
            <p className="text-muted-foreground">{info.relevant_history}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
