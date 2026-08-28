import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import {
  getCidDescriptions,
  listDiagnosesForRecords,
  listMedicalRecordsForPatient,
} from "@/services/records.service"
import { sumEffectiveSecondsByQueueEntry } from "@/services/service.service"
import { EmptyState } from "@/components/shared/empty-state"
import { PrintLink } from "@/components/shared/print-link"
import { formatDate } from "@/utils/datetime"

function formatDuration(seconds: number | null) {
  if (seconds === null || seconds <= 0) return null
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/**
 * Chronological record of the patient's visits (item 13: "preferencialmente como
 * timeline"). Each entry carries how long the visit actually took — real settled data
 * from service_sessions.effective_seconds, not an estimate — so the professional can
 * see the rhythm of treatment at a glance.
 */
export async function PatientTimeline({
  clinicId,
  patientId,
  excludeRecordId,
}: {
  clinicId: string
  patientId: string
  /** The visit in progress, kept out of its own history. */
  excludeRecordId?: string
}) {
  // Clinical content, so it enforces records.view itself rather than trusting whoever
  // rendered it. The architecture doc is explicit that a hidden tab is not authorization
  // (docs/ARCHITECTURE.md §5, briefing item 23) — reception holds patients.view but not
  // records.view, and RLS alone would let it read every prontuário.
  await requirePermission(PERMISSIONS.RECORDS_VIEW)

  const supabase = await createClient()
  const allRecords = await listMedicalRecordsForPatient(supabase, clinicId, patientId)
  const records = allRecords.filter((r) => r.id !== excludeRecordId)

  if (records.length === 0) {
    return (
      <EmptyState
        title="Primeiro atendimento"
        description="Este paciente ainda não tem atendimentos anteriores registrados."
      />
    )
  }

  const queueEntryIds = records.map((r) => r.queue_entry_id).filter(Boolean) as string[]
  const [diagnoses, durationByQueueEntry] = await Promise.all([
    listDiagnosesForRecords(supabase, records.map((r) => r.id)),
    sumEffectiveSecondsByQueueEntry(supabase, queueEntryIds),
  ])
  const cidDescriptions = await getCidDescriptions(supabase, diagnoses.map((d) => d.cid_code))

  return (
    <ol className="relative grid gap-3">
      {records.map((record) => {
        const duration = formatDuration(
          record.queue_entry_id ? durationByQueueEntry.get(record.queue_entry_id) ?? null : null
        )
        const recordDiagnoses = diagnoses.filter((d) => d.medical_record_id === record.id)
        const summary =
          record.assessment || record.chief_complaint || record.plan || record.notes || null

        return (
          <li
            key={record.id}
            className="rounded-xl border border-border bg-card p-4 shadow-soft transition-colors hover:border-ring/30"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-heading text-[0.9rem] font-semibold tabular-nums">
                {formatDate(record.created_at)}
                <PrintLink
                  href={`/imprimir/prontuario/${record.id}`}
                  label={`Imprimir prontuário de ${formatDate(record.created_at)}`}
                />
              </p>
              {duration && (
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[0.7rem] font-medium text-secondary-foreground tabular-nums">
                  {duration}
                </span>
              )}
            </div>

            {summary ? (
              <p className="mt-1.5 text-[0.85rem] leading-relaxed text-muted-foreground">{summary}</p>
            ) : (
              <p className="mt-1.5 text-[0.85rem] text-muted-foreground/70 italic">
                Sem registro clínico preenchido.
              </p>
            )}

            {recordDiagnoses.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {recordDiagnoses.map((d) => (
                  <span
                    key={d.id}
                    className="rounded-md bg-accent px-1.5 py-0.5 text-[0.7rem] text-accent-foreground"
                    title={cidDescriptions.get(d.cid_code) ?? undefined}
                  >
                    <span className="font-mono">{d.cid_code}</span>
                  </span>
                ))}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
