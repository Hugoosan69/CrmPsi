import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { ConfigurationRequired } from "@/components/shared/configuration-required"
import { NewPasswordForm } from "./new-password-form"

export default function RedefinirSenhaPage() {
  if (!isSupabaseConfigured()) {
    return <ConfigurationRequired />
  }

  return (
    <Card className="shadow-lifted">
      <CardHeader className="pt-7">
        <CardTitle className="font-heading text-[1.15rem]">Definir nova senha</CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-7">
        <NewPasswordForm />
      </CardContent>
    </Card>
  )
}
