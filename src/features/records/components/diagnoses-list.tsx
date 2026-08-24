"use client"

import { useTransition } from "react"
import { X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { addDiagnosisAction, removeDiagnosisAction } from "../actions/record.actions"
import { CidCombobox } from "./cid-combobox"

type Diagnosis = { id: string; cid_code: string; is_primary: boolean }

export function DiagnosesList({
  medicalRecordId,
  queueEntryId,
  patientId,
  diagnoses,
  cidDescriptions,
}: {
  medicalRecordId: string
  queueEntryId: string
  patientId: string
  diagnoses: Diagnosis[]
  cidDescriptions: Map<string, string>
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {diagnoses.length === 0 && <span className="text-sm text-muted-foreground">Nenhum CID adicionado</span>}
        {diagnoses.map((d) => (
          <Badge key={d.id} variant={d.is_primary ? "default" : "secondary"} className="gap-1 pr-1">
            <span className="font-mono text-xs">{d.cid_code}</span>
            <span className="max-w-40 truncate">{cidDescriptions.get(d.cid_code) ?? ""}</span>
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(() => removeDiagnosisAction(d.id, medicalRecordId, queueEntryId, patientId))
              }
              className="ml-1 rounded-full hover:bg-foreground/10"
              aria-label="Remover CID"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div>
        <CidCombobox
          onSelect={(option) =>
            startTransition(() =>
              addDiagnosisAction(medicalRecordId, queueEntryId, patientId, option.code, diagnoses.length === 0)
            )
          }
        />
      </div>
    </div>
  )
}
