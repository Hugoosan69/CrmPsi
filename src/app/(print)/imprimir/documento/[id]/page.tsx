import { notFound } from "next/navigation"

import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { getPrintableDocument } from "@/services/documents.service"
import { formatDate } from "@/utils/datetime"
import { DocumentFooter, DocumentHeader, Signature } from "../../document-chrome"
import { PrintToolbar } from "../../print-toolbar"

const TYPE_LABEL: Record<string, string> = {
  atestado: "ATESTADO MÉDICO",
  declaracao: "DECLARAÇÃO",
  relatorio: "RELATÓRIO",
  encaminhamento: "ENCAMINHAMENTO",
  outros: "DOCUMENTO",
}

export default async function PrintDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const membership = await requirePermission(PERMISSIONS.RECORDS_VIEW)
  const { id } = await params

  const supabase = await createClient()
  const doc = await getPrintableDocument(supabase, membership.clinicId, id)
  if (!doc) notFound()

  const patientName = doc.patient.social_name || doc.patient.full_name
  const issuedOn = formatDate(doc.issued_at)

  return (
    <>
      <PrintToolbar backHref="/profissional/fila" />

      <article className="doc-page">
        <DocumentHeader title={TYPE_LABEL[doc.type] ?? "DOCUMENTO"} align="none" />

        <div className="doc-title-center" style={{ marginTop: 60 }}>
          <h1>{TYPE_LABEL[doc.type] ?? "DOCUMENTO"}</h1>
        </div>

        <div className="doc-prose">
          <p>
            Atesto, para os devidos fins, que{" "}
            <strong style={{ color: "var(--doc-primary)" }}>{patientName}</strong>
            {doc.patient.cpf ? (
              <>
                , portador(a) do CPF nº <strong>{doc.patient.cpf}</strong>
              </>
            ) : null}
            , foi atendido(a) nesta unidade de saúde na data de <strong>{issuedOn}</strong>.
          </p>

          {/* O conteúdo é escrito pelo profissional no editor, então vai destacado e com as
              quebras de linha preservadas — reformatá-lo mudaria o texto de um documento
              que tem valor legal. */}
          <div className="doc-highlight">{doc.content}</div>

          <p>
            O presente documento é emitido a pedido do(a) interessado(a), para os fins que se
            fizerem necessários.
          </p>
        </div>

        <div className="doc-place-date">Brasília, {issuedOn}.</div>

        <Signature
          name={doc.professional.full_name}
          specialty={doc.professional.specialty}
          register={doc.professional.professional_register}
        />

        <div className="doc-validation">
          Documento emitido eletronicamente pelo sistema CSIB.
          <br />
          Código de validação: <strong>{doc.id.slice(0, 8).toUpperCase()}</strong>
        </div>

        <DocumentFooter />
      </article>
    </>
  )
}
