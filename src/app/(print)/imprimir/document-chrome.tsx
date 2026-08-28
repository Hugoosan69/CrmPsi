import { createClient } from "@/lib/supabase/server"
import { getPublicBranding } from "@/services/clinic-settings.service"

const FALLBACK_NAME = "Centro de Saúde Integrada de Brasília"

/**
 * Cabeçalho e rodapé compartilhados pelos três documentos.
 *
 * A marca vem das configurações da clínica em vez de ser fixa: quem trocou a logo em
 * Gestão › Configurações espera vê-la no papel também, e um documento clínico com a
 * identidade errada é pior do que um sem identidade.
 */
export async function DocumentHeader({
  title,
  subtitle,
  align = "right",
}: {
  title: string
  subtitle?: string
  /** "right" põe o título ao lado da marca (prontuário); "none" deixa só a marca,
   *  para quando o título vem centralizado abaixo (receituário, atestado). */
  align?: "right" | "none"
}) {
  const branding = await getPublicBranding(await createClient())
  const clinicName = branding?.name ?? FALLBACK_NAME
  const logoUrl = branding?.logoUrl

  return (
    <header className="doc-header">
      <div className="doc-brand">
        <div className="doc-logo">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" />
          ) : (
            "CSIB"
          )}
        </div>
        <div>
          <div className="doc-brand-name">CSIB</div>
          <div className="doc-brand-subtitle">{clinicName}</div>
        </div>
      </div>

      {align === "right" && (
        <div className="doc-title-right">
          <h1>{title}</h1>
          {subtitle && <span>{subtitle}</span>}
        </div>
      )}
    </header>
  )
}

export async function DocumentFooter({ note }: { note?: string }) {
  const branding = await getPublicBranding(await createClient())
  const clinicName = branding?.name ?? FALLBACK_NAME

  return (
    <footer className="doc-footer">
      <span>{clinicName}</span>
      <span>{note ?? "Documento gerado eletronicamente pelo sistema CSIB"}</span>
    </footer>
  )
}

export function Signature({
  name,
  specialty,
  register,
}: {
  name: string
  specialty?: string | null
  register?: string | null
}) {
  const info = [specialty, register].filter(Boolean).join(" • ")
  return (
    <div className="doc-signature">
      <div className="doc-signature-line">
        <div className="doc-signature-name">{name}</div>
        {info && <div className="doc-signature-info">{info}</div>}
      </div>
    </div>
  )
}

export function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="doc-field-label">{label}</div>
      <div className="doc-field-value">{value || "—"}</div>
    </div>
  )
}
