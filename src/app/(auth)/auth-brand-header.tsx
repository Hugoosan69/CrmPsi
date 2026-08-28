import Image from "next/image"

import { CardHeader } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { getPublicBranding } from "@/services/clinic-settings.service"

const FALLBACK_LOGO = "/branding/csib-logo.svg"

/**
 * Identity block shared by every screen in the auth group, so login, "recuperar acesso" and
 * "definir nova senha" read as the same product. Duplicating the logo/branding fetch in
 * three pages is how they drift.
 *
 * `subtitle` replaces the clinic name when the screen needs to say what it is for — on the
 * recovery screens the task matters more than repeating the clinic's full name.
 */
export async function AuthBrandHeader({
  title = "CSIB",
  subtitle,
}: {
  title?: string
  subtitle?: string
}) {
  const branding = await getPublicBranding(await createClient())
  const logoSrc = branding?.logoUrl || FALLBACK_LOGO
  const clinicName = branding?.name ?? "Centro de Saúde Integrada de Brasília"

  return (
    // CardHeader is `display: grid`, so horizontal centering needs justify-items —
    // `items-center` (align-items) only centers on the block axis and leaves an element
    // with its own intrinsic width, like the logo, sitting at the inline start. The title
    // looked centered anyway because `text-center` centers inline content inside a box
    // that stretches the full width, which is what made the misalignment look like it was
    // only the image's problem.
    <CardHeader className="justify-items-center gap-3 pt-8 text-center">
      {logoSrc === FALLBACK_LOGO ? (
        <Image src={FALLBACK_LOGO} alt="" width={56} height={56} priority />
      ) : (
        // An operator-supplied URL can point at any host, which next/image would reject
        // without remotePatterns config for every possible one.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoSrc} alt="" className="max-h-14 w-auto max-w-[11rem] object-contain" />
      )}
      <div>
        <p className="font-heading text-[1.6rem] leading-none font-semibold tracking-tight">
          {title}
        </p>
        <p className="mt-1.5 text-[0.78rem] text-muted-foreground">{subtitle ?? clinicName}</p>
      </div>
    </CardHeader>
  )
}
