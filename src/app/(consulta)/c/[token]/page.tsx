import { createClient } from "@/lib/supabase/server"
import { getPublicBranding } from "@/services/clinic-settings.service"
import { PatientRoom } from "@/features/telehealth/components/patient-room"

export const dynamic = "force-dynamic"

/** O paciente não deve aparecer em busca nenhuma, e o link não deve vazar por referer. */
export const metadata = {
  title: "Consulta por vídeo",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
}

/**
 * A sala do paciente.
 *
 * O token NÃO é validado aqui, de propósito: quem valida é o endpoint que emite o acesso,
 * chamado pelo componente de cliente. Assim existe um caminho só para a decisão — e o
 * token não passa por um Server Component que poderia registrá-lo em log de renderização.
 *
 * A marca da clínica é lida pela função pública `public_clinic_branding` (migration 003),
 * a mesma da tela de login: é o que faz o paciente reconhecer onde está, sem exigir sessão.
 */
export default async function ConsultaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const branding = await getPublicBranding(await createClient()).catch(() => null)

  return (
    <div className="grid gap-5">
      <header className="flex items-center gap-3">
        {/* `img` e não `next/image`, pelo mesmo motivo da sidebar: a logo é uma URL enviada
            pelo operador e pode apontar para qualquer host, o que exigiria `remotePatterns`
            para cada um. Com `next/image` a página inteira responde 500 quando o host não
            está na lista — numa tela que só o paciente abre, isso é a consulta perdida. */}
        {branding?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoUrl}
            alt=""
            className="size-9 shrink-0 rounded-lg object-contain"
          />
        ) : null}
        <div>
          <p className="font-heading text-[0.95rem] font-semibold">
            {branding?.name ?? "Consulta por vídeo"}
          </p>
          <p className="text-[0.78rem] text-muted-foreground">Atendimento por vídeo</p>
        </div>
      </header>

      <PatientRoom token={token} />
    </div>
  )
}
