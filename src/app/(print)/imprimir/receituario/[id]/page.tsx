import { notFound } from "next/navigation"

import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { getPrintablePrescription } from "@/services/prescriptions.service"
import { formatDate } from "@/utils/datetime"
import { DocumentFooter, DocumentHeader, Signature } from "../../document-chrome"
import { PrintToolbar } from "../../print-toolbar"

/** "Dipirona 500mg — comprimido" a partir das partes que estiverem preenchidas. */
function presentation(item: {
  concentration: string | null
  pharmaceutical_form: string | null
}) {
  return [item.concentration, item.pharmaceutical_form].filter(Boolean).join(" — ")
}

/** Posologia montada das partes; o que não foi preenchido simplesmente não aparece, em vez
 *  de deixar rótulos vazios num documento que o paciente leva para a farmácia. */
function posology(item: {
  dose: string | null
  frequency: string | null
  duration: string | null
  quantity: string | null
}) {
  return [
    item.dose,
    item.frequency,
    item.duration,
    item.quantity ? `Quantidade: ${item.quantity}` : null,
  ]
    .filter(Boolean)
    .join(" · ")
}

export default async function PrintPrescriptionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const membership = await requirePermission(PERMISSIONS.RECORDS_VIEW)
  const { id } = await params

  const supabase = await createClient()
  const prescription = await getPrintablePrescription(supabase, membership.clinicId, id)
  if (!prescription) notFound()

  const patientName = prescription.patient.social_name || prescription.patient.full_name

  return (
    <>
      <PrintToolbar backHref="/profissional/fila" />

      <article className="doc-page">
        <DocumentHeader title="RECEITUÁRIO" align="none" />

        <div className="doc-title-center">
          <h1>RECEITUÁRIO</h1>
          <span>Prescrição médica</span>
        </div>

        <div className="doc-patient-card">
          <div>
            <div className="doc-field-label">Paciente</div>
            <div style={{ marginTop: 5, fontSize: 12 }}>{patientName}</div>
          </div>
          <div>
            <div className="doc-field-label">CPF</div>
            <div style={{ marginTop: 5, fontSize: 12 }}>{prescription.patient.cpf || "—"}</div>
          </div>
          <div>
            <div className="doc-field-label">Data</div>
            <div style={{ marginTop: 5, fontSize: 12 }}>
              {formatDate(prescription.issued_at)}
            </div>
          </div>
        </div>

        <section style={{ marginTop: 30 }}>
          {prescription.items.length === 0 ? (
            <div className="doc-box">Nenhum medicamento prescrito.</div>
          ) : (
            prescription.items.map((item, index) => (
              <div key={index} className="doc-medicine">
                <div className="doc-medicine-number">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="doc-medicine-name">{item.medication_name}</div>
                {presentation(item) && (
                  <div className="doc-medicine-description">{presentation(item)}</div>
                )}
                {posology(item) && (
                  <div className="doc-posology">
                    <strong>Posologia:</strong> {posology(item)}
                  </div>
                )}
                {item.instructions && (
                  <div className="doc-medicine-description">{item.instructions}</div>
                )}
              </div>
            ))
          )}
        </section>

        {prescription.notes && (
          <section style={{ marginTop: 30 }}>
            <div className="doc-section-title">Orientações</div>
            <div className="doc-box">{prescription.notes}</div>
          </section>
        )}

        <Signature
          name={prescription.professional.full_name}
          specialty={prescription.professional.specialty}
          register={prescription.professional.professional_register}
        />

        <DocumentFooter note="Documento emitido eletronicamente pelo sistema CSIB" />
      </article>
    </>
  )
}
