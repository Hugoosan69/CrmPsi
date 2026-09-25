import type { SupabaseClient } from "@supabase/supabase-js"

import { EmptyState } from "@/components/shared/empty-state"
import type { Database } from "@/types/supabase"
import {
  getCidDescriptions,
  listDiagnosesForRecords,
  listMedicalRecordsForPatient,
} from "@/services/records.service"
import { MedicalRecordForm } from "./medical-record-form"
import { DiagnosesList } from "./diagnoses-list"
import { formatDateTime } from "@/utils/datetime"

type DB = SupabaseClient<Database>

function preview(text: string | null, max = 90): string {
  if (!text) return "Sem queixa registrada"
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/**
 * O histórico de prontuário do paciente — cada atendimento registrado, mais recente
 * primeiro. Até aqui o prontuário só existia DENTRO do atendimento em curso
 * (`/profissional/atendimento/[id]`): fechada aquela tela, não havia como olhar ou corrigir
 * um registro antigo a partir da ficha do paciente. Reaproveita `MedicalRecordForm` e
 * `DiagnosesList` — mesma edição, mesmas permissões, só chamados de outro lugar.
 */
export async function PatientMedicalRecordsPanel({
  supabase,
  clinicId,
  patientId,
  canEdit,
}: {
  supabase: DB
  clinicId: string
  patientId: string
  canEdit: boolean
}) {
  const records = await listMedicalRecordsForPatient(supabase, clinicId, patientId)

  if (records.length === 0) {
    return (
      <EmptyState
        title="Nenhum registro de prontuário ainda"
        description="Os registros aparecem aqui depois do primeiro atendimento."
      />
    )
  }

  const [diagnoses, professionalsResult] = await Promise.all([
    listDiagnosesForRecords(
      supabase,
      records.map((r) => r.id)
    ),
    supabase
      .from("professionals")
      .select("id, full_name")
      .in("id", [...new Set(records.map((r) => r.professional_id))]),
  ])

  const cidDescriptions = await getCidDescriptions(
    supabase,
    [...new Set(diagnoses.map((d) => d.cid_code))]
  )
  const professionalNames = new Map(
    (professionalsResult.data ?? []).map((p) => [p.id, p.full_name])
  )
  const diagnosesByRecord = new Map<string, typeof diagnoses>()
  for (const d of diagnoses) {
    const list = diagnosesByRecord.get(d.medical_record_id) ?? []
    list.push(d)
    diagnosesByRecord.set(d.medical_record_id, list)
  }

  return (
    <div className="grid gap-3">
      {records.map((record, index) => {
        const recordDiagnoses = diagnosesByRecord.get(record.id) ?? []
        // O identificador que MedicalRecordForm usa só para revalidar a página do
        // atendimento (item cosmético) — um registro aberto por aqui pode não ter vindo
        // de uma fila viva, então cai no próprio id quando falta.
        const queueEntryId = record.queue_entry_id ?? record.id
        return (
          <details
            key={record.id}
            open={index === 0}
            className="group rounded-xl border border-border bg-card"
          >
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 p-4 [&::-webkit-details-marker]:hidden">
              <span className="text-sm font-medium">
                {formatDateTime(record.created_at)}
              </span>
              <span className="text-[0.8rem] text-muted-foreground">
                {professionalNames.get(record.professional_id) ?? "Profissional"}
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.8rem] text-muted-foreground">
                {preview(record.chief_complaint)}
              </span>
              <span className="ml-auto text-[0.72rem] text-muted-foreground transition-transform group-open:rotate-180">
                ▾
              </span>
            </summary>

            <div className="grid gap-4 border-t border-border p-4">
              <div className="grid gap-1.5">
                <span className="text-[0.7rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                  Diagnósticos (CID)
                </span>
                {canEdit ? (
                  <DiagnosesList
                    medicalRecordId={record.id}
                    queueEntryId={queueEntryId}
                    patientId={patientId}
                    diagnoses={recordDiagnoses}
                    cidDescriptions={cidDescriptions}
                  />
                ) : recordDiagnoses.length === 0 ? (
                  <span className="text-sm text-muted-foreground">Nenhum CID registrado</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {recordDiagnoses.map((d) => (
                      <span
                        key={d.id}
                        className="rounded-full bg-muted px-2.5 py-1 text-[0.78rem]"
                      >
                        <span className="font-mono">{d.cid_code}</span> —{" "}
                        {cidDescriptions.get(d.cid_code) ?? ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {canEdit ? (
                <MedicalRecordForm
                  medicalRecord={record}
                  queueEntryId={queueEntryId}
                  patientId={patientId}
                />
              ) : (
                <dl className="grid gap-3">
                  {(
                    [
                      ["Queixa principal", record.chief_complaint],
                      ["História", record.history],
                      ["Exame", record.exam],
                      ["Avaliação", record.assessment],
                      ["Plano / evolução", record.plan],
                      ["Observações", record.notes],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[0.7rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                        {label}
                      </dt>
                      <dd className="mt-0.5 text-sm whitespace-pre-line">{value || "—"}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </details>
        )
      })}
    </div>
  )
}
