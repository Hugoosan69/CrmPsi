import { Card, CardContent } from "@/components/ui/card"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { ConfigurationRequired } from "@/components/shared/configuration-required"
import { AuthBrandHeader } from "../auth-brand-header"
import { LoginForm } from "./login-form"
import { RecoveryHandoff } from "./recovery-handoff"

export default function LoginPage() {
  // Without configuration the form would accept credentials and then fail with an
  // opaque error — say so up front instead.
  if (!isSupabaseConfigured()) {
    return <ConfigurationRequired />
  }

  return (
    <div className="grid gap-5">
      <Card className="shadow-lifted">
        <AuthBrandHeader />
        <CardContent className="px-6 pb-7">
          {/* Catches a recovery return that Supabase sent here instead of
              /redefinir-senha — see recovery-handoff.tsx. */}
          <RecoveryHandoff />
          <LoginForm />
        </CardContent>
      </Card>

      <p className="text-center text-[0.72rem] text-white/45">
        Acesso restrito à equipe da clínica
      </p>
    </div>
  )
}
