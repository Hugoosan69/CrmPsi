import Image from "next/image"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { ConfigurationRequired } from "@/components/shared/configuration-required"
import { createClient } from "@/lib/supabase/server"
import { getPublicBranding } from "@/services/clinic-settings.service"
import { LoginForm } from "./login-form"

const FALLBACK_LOGO = "/branding/csib-logo.svg"

export default async function LoginPage() {
  // Without configuration the form would accept credentials and then fail with an
  // opaque error — say so up front instead.
  if (!isSupabaseConfigured()) {
    return <ConfigurationRequired />
  }

  // Configurable in Gestão › Configurações. Falls back to the bundled asset, so a clinic
  // that has not uploaded a logo — or a database without migration 003 — still gets a
  // complete login screen.
  const branding = await getPublicBranding(await createClient())
  const logoSrc = branding?.logoUrl || FALLBACK_LOGO
  const clinicName = branding?.name ?? "Centro de Saúde Integrada de Brasília"

  return (
    <div className="grid gap-5">
      <Card className="shadow-lifted">
        <CardHeader className="items-center gap-3 pt-8 text-center">
          {logoSrc === FALLBACK_LOGO ? (
            <Image src={FALLBACK_LOGO} alt="" width={56} height={56} priority />
          ) : (
            // An operator-supplied URL can point at any host, which next/image would
            // reject without remotePatterns config for every possible one.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt="" className="max-h-14 w-auto max-w-[11rem] object-contain" />
          )}
          <div>
            <p className="font-heading text-[1.6rem] leading-none font-semibold tracking-tight">CSIB</p>
            <p className="mt-1.5 text-[0.78rem] text-muted-foreground">{clinicName}</p>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-7">
          <LoginForm />
        </CardContent>
      </Card>

      <p className="text-center text-[0.72rem] text-white/45">
        Acesso restrito à equipe da clínica
      </p>
    </div>
  )
}
