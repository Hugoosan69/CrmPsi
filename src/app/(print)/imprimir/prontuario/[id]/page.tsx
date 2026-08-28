import { notFound } from "next/navigation"

import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { getPrintableRecord } from "@/services/records.service"
import { formatDate } from "@/utils/datetime"
import {
  DocumentFooter,
  DocumentHeader,
  Field,
  Signature,
} from "../../document-chrome"
import { PrintToolbar } from "../../print-toolbar"

export default async function PrintRecordPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // records.view e não documents.issue: um prontuário é leitura do histórico clínico, e
  // quem pode vê-lo na tela pode imprimi-lo.
  const membership = await requirePermission(PERMISSIONS.RECORDS_VIEW)
  const { id } = await params

  const supabase = await createClient()
  const record = await getPrintableRecord(supabase, membership.clinicId, id)
  if (!record) notFound()

  const patientName = record.patient.social_name || record.patient.full_name

  return (
    <>
      <PrintToolbar backHref="/profissional/fila" />

      <article className="doc-page">
        <DocumentHeader title="PRONTUÁRIO CLÍNICO" subtitle="Documento de atendimento" />

        <section className="doc-section">
          <div className="doc-section-title">Identificação do paciente</div>
          <div className="doc-grid-3">
            <Field label="Paciente" value={patientName} />
            <Field label="CPF" value={record.patient.cpf} />
            <Field
              label="Data de nascimento"
              value={record.patient.birth_date ? formatDate(record.patient.birth_date) : null}
            />
          </div>
        </section>

        <section className="doc-section">
          <div className="doc-section-title">Dados do atendimento</div>
          <div className="doc-grid-3">
            <Field label="Profissional" value={record.professional.full_name} />
            <Field label="Especialidade" value={record.professional.specialty} />
            <Field label="Data" value={formatDate(record.created_at)} />
          </div>
        </section>

        <section className="doc-section">
          <div className="doc-section-title">Queixa principal</div>
          <div className="doc-box">{record.chief_complaint || "—"}</div>
        </section>

        <section className="doc-section">
          <div className="doc-section-title">Anamnese / História clínica</div>
          <div className="doc-box is-large">{record.history || "—"}</div>
        </section>

        <section className="doc-section">
          <div className="doc-section-title">Exame físico</div>
          <div className="doc-box">{record.exam || "—"}</div>
        </section>

        <section className="doc-section">
          <div className="doc-grid-2">
            <div>
              <div className="doc-section-title">Avaliação</div>
              <div className="doc-box">{record.assessment || "—"}</div>
            </div>
            <div>
              <div className="doc-section-title">Conduta / Plano</div>
              <div className="doc-box">{record.plan || "—"}</div>
            </div>
          </div>
        </section>

        <Signature
          name={record.professional.full_name}
          specialty={record.professional.specialty}
          register={record.professional.professional_register}
        />

        <DocumentFooter />
      </article>
    </>
  )
}
