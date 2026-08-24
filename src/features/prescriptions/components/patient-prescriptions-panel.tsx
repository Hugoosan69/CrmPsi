import { createClient } from "@/lib/supabase/server"
import { listPrescriptionItems, listPrescriptionsForPatient } from "@/services/prescriptions.service"
import { EmptyState } from "@/components/shared/empty-state"
import { formatDateTime } from "@/utils/datetime"

/** Previously issued prescriptions, newest first — so the professional can see what the
 * patient is already taking before writing a new one. */
export async function PatientPrescriptionsPanel({
  clinicId,
  patientId,
}: {
  clinicId: string
  patientId: string
}) {
  const supabase = await createClient()
  const prescriptions = await listPrescriptionsForPatient(supabase, clinicId, patientId)

  if (prescriptions.length === 0) {
    return (
      <EmptyState
        title="Nenhuma prescrição anterior"
        description="As prescrições emitidas para este paciente aparecerão aqui."
        showMascot={false}
      />
    )
  }

  const items = await listPrescriptionItems(supabase, prescriptions.map((p) => p.id))

  return (
    <ol className="grid gap-3">
      {prescriptions.map((prescription) => {
        const own = items.filter((i) => i.prescription_id === prescription.id)
        return (
          <li key={prescription.id} className="rounded-xl border border-border bg-card p-4 shadow-soft">
            <p className="font-heading text-[0.85rem] font-semibold tabular-nums">
              {formatDateTime(prescription.issued_at)}
            </p>
            <ul className="mt-2 grid gap-1.5">
              {own.map((item) => (
                <li key={item.id} className="text-[0.85rem] leading-snug">
                  <span className="font-medium">{item.medication_name}</span>
                  {item.concentration ? ` ${item.concentration}` : ""}
                  {(item.dose || item.frequency || item.duration) && (
                    <span className="text-muted-foreground">
                      {" — "}
                      {[item.dose, item.frequency, item.duration].filter(Boolean).join(", ")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {prescription.notes && (
              <p className="mt-2 text-[0.8rem] text-muted-foreground">{prescription.notes}</p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
