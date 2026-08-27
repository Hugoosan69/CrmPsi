import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { ConfigurationRequired } from "@/components/shared/configuration-required"
import { ResetRequestForm } from "./reset-request-form"

export default function RecuperarSenhaPage() {
  if (!isSupabaseConfigured()) {
    return <ConfigurationRequired />
  }

  return (
    <div className="grid gap-5">
      <Card className="shadow-lifted">
        <CardHeader className="pt-7">
          <CardTitle className="font-heading text-[1.15rem]">Recuperar acesso</CardTitle>
          <p className="mt-1 text-[0.82rem] text-muted-foreground">
            Informe o e-mail da sua conta. Enviaremos um link para você definir uma nova senha.
          </p>
        </CardHeader>
        <CardContent className="px-6 pb-7">
          <ResetRequestForm />
        </CardContent>
      </Card>

      <p className="text-center text-[0.75rem] text-white/55">
        <Link href="/login" className="underline underline-offset-2 hover:text-white/80">
          Voltar para o login
        </Link>
      </p>
    </div>
  )
}
