import Link from "next/link"

import { Card, CardContent } from "@/components/ui/card"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { ConfigurationRequired } from "@/components/shared/configuration-required"
import { AuthBrandHeader } from "../auth-brand-header"
import { ResetRequestForm } from "./reset-request-form"

export default function RecuperarSenhaPage() {
  if (!isSupabaseConfigured()) {
    return <ConfigurationRequired />
  }

  return (
    <div className="grid gap-5">
      <Card className="shadow-lifted">
        <AuthBrandHeader subtitle="Recuperar acesso" />
        <CardContent className="px-6 pb-7">
          <ResetRequestForm />
        </CardContent>
      </Card>

      <p className="text-center text-[0.72rem] text-white/45">
        <Link href="/login" className="underline underline-offset-2 hover:text-white/70">
          Voltar para o login
        </Link>
      </p>
    </div>
  )
}
