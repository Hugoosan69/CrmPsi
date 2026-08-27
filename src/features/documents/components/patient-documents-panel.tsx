import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import { listClinicalDocumentsForPatient } from "@/services/documents.service"
import { EmptyState } from "@/components/shared/empty-state"
import { formatDateTime } from "@/utils/datetime"
import type { ClinicalDocumentType } from "@/types/supabase"

const TYPE_LABELS: Record<ClinicalDocumentType, string> = {
  atestado: "Atestado",
  declaracao: "Declaração",
  relatorio: "Relatório",
  encaminhamento: "Encaminhamento",
  outros: "Outro documento",
}

/** Documents already issued for this patient — atestados, declarações, relatórios. */
export async function PatientDocumentsPanel({
  clinicId,
  patientId,
}: {
  clinicId: string
  patientId: string
}) {
  // Clinical content, so it enforces records.view itself rather than trusting whoever
  // rendered it. The architecture doc is explicit that a hidden tab is not authorization
  // (docs/ARCHITECTURE.md §5, briefing item 23) — reception holds patients.view but not
  // records.view, and RLS alone would let it read every prontuário.
  await requirePermission(PERMISSIONS.RECORDS_VIEW)

  const supabase = await createClient()
  const documents = await listClinicalDocumentsForPatient(supabase, clinicId, patientId)

  if (documents.length === 0) {
    return (
      <EmptyState
        title="Nenhum documento emitido"
        description="Atestados, declarações e relatórios aparecerão aqui."
        showMascot={false}
      />
    )
  }

  return (
    <ol className="grid gap-3">
      {documents.map((document) => (
        <li key={document.id} className="rounded-xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-heading text-[0.85rem] font-semibold">{TYPE_LABELS[document.type]}</p>
            <span className="shrink-0 text-[0.72rem] text-muted-foreground tabular-nums">
              {formatDateTime(document.issued_at)}
            </span>
          </div>
          <p className="mt-1.5 line-clamp-3 text-[0.82rem] whitespace-pre-line text-muted-foreground">
            {document.content}
          </p>
        </li>
      ))}
    </ol>
  )
}
