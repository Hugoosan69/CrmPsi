import Image from "next/image"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { ConfigurationRequired } from "@/components/shared/configuration-required"
import { LoginForm } from "./login-form"

export default function LoginPage() {
  // Without configuration the form would accept credentials and then fail with an
  // opaque error — say so up front instead.
  if (!isSupabaseConfigured()) {
    return <ConfigurationRequired />
  }

  return (
    <div className="grid gap-5">
      <Card className="shadow-lifted">
        <CardHeader className="items-center gap-3 pt-8 text-center">
          <Image src="/branding/csib-logo.svg" alt="CSIB" width={56} height={56} priority />
          <div>
            <p className="font-heading text-[1.6rem] leading-none font-semibold tracking-tight">CSIB</p>
            <p className="mt-1.5 text-[0.78rem] text-muted-foreground">
              Centro de Saúde Integrada de Brasília
            </p>
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
