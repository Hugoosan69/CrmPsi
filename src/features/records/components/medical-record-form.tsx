"use client"

import { useActionState, useState } from "react"
import { Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { Database } from "@/types/supabase"
import { updateMedicalRecordAction, type RecordActionState } from "../actions/record.actions"

type MedicalRecord = Database["public"]["Tables"]["medical_records"]["Row"]

const initialState: RecordActionState = {}

/** Counted field: the limit is visible while typing, so nothing is silently truncated
 * and the professional knows how much room is left (pattern taken from the reviewed
 * prototype's 0/500 · 0/3500 counters). */
function CountedField({
  name,
  label,
  rows,
  maxLength,
  defaultValue,
  placeholder,
}: {
  name: string
  label: string
  rows: number
  maxLength: number
  defaultValue: string
  placeholder?: string
}) {
  const [value, setValue] = useState(defaultValue)
  const near = value.length > maxLength * 0.9

  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={name}>{label}</Label>
        <span
          className={cn(
            "text-[0.7rem] tabular-nums",
            near ? "font-medium text-status-warning" : "text-muted-foreground/70"
          )}
        >
          {value.length}/{maxLength}
        </span>
      </div>
      <Textarea
        id={name}
        name={name}
        rows={rows}
        maxLength={maxLength}
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  )
}

export function MedicalRecordForm({
  medicalRecord,
  queueEntryId,
  patientId,
}: {
  medicalRecord: MedicalRecord
  queueEntryId: string
  patientId: string
}) {
  const action = updateMedicalRecordAction.bind(null, medicalRecord.id, queueEntryId, patientId)
  const [state, formAction, isPending] = useActionState(action, initialState)

  return (
    <form action={formAction} className="grid gap-4">
      <CountedField
        name="chief_complaint"
        label="Queixa principal"
        rows={3}
        maxLength={500}
        defaultValue={medicalRecord.chief_complaint ?? ""}
        placeholder="Descreva a queixa relatada pelo paciente."
      />
      <CountedField
        name="history"
        label="História"
        rows={3}
        maxLength={2000}
        defaultValue={medicalRecord.history ?? ""}
      />
      <CountedField
        name="exam"
        label="Exame"
        rows={3}
        maxLength={2000}
        defaultValue={medicalRecord.exam ?? ""}
      />
      <CountedField
        name="assessment"
        label="Avaliação"
        rows={3}
        maxLength={2000}
        defaultValue={medicalRecord.assessment ?? ""}
      />
      <CountedField
        name="plan"
        label="Plano / evolução"
        rows={5}
        maxLength={3500}
        defaultValue={medicalRecord.plan ?? ""}
        placeholder="Descreva aqui o registro da sessão e a conduta."
      />
      <CountedField
        name="notes"
        label="Observações"
        rows={2}
        maxLength={1000}
        defaultValue={medicalRecord.notes ?? ""}
      />

      {state.error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar registro"}
        </Button>
        {state.success && !isPending && (
          <span className="flex items-center gap-1.5 text-sm text-status-success" role="status">
            <Check className="size-4" /> Registro salvo
          </span>
        )}
      </div>
    </form>
  )
}
