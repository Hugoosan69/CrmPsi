"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PasswordField } from "@/components/ui/password-field"
import { createClient } from "@/lib/supabase/client"
import { newPasswordSchema } from "@/schemas/auth.schema"

type Phase = "checking" | "ready" | "invalid" | "done"

/**
 * Recovery has to be handled in the browser.
 *
 * Supabase's recovery link returns the operator with the token in the URL *fragment*
 * (`#access_token=…&type=recovery`), and a fragment is never sent to the server — a Server
 * Component literally cannot see it. The browser client consumes the fragment on load
 * (detectSessionInUrl) and writes the session to cookies; only then is `updateUser` allowed
 * to set a new password.
 */
export function NewPasswordForm() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("checking")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const supabase = createClient()

    // onAuthStateChange fires PASSWORD_RECOVERY once the fragment has been parsed, which is
    // more reliable than racing getSession() against that parsing.
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) setPhase("ready")
      else if (event === "INITIAL_SESSION") setPhase("invalid")
    })

    // Fallback for the case where the event already fired before this effect ran.
    void supabase.auth.getSession().then(({ data }) => {
      setPhase((current) =>
        current === "checking" ? (data.session ? "ready" : "invalid") : current
      )
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  function submit(formData: FormData) {
    const parsed = newPasswordSchema.safeParse({
      password: formData.get("password"),
      confirm: formData.get("confirm"),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos")
      return
    }

    startTransition(async () => {
      setError(null)
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({
        password: parsed.data.password,
      })
      if (updateError) {
        setError(
          updateError.message.toLowerCase().includes("same")
            ? "A nova senha precisa ser diferente da atual."
            : "Não foi possível alterar a senha. O link pode ter expirado — solicite outro."
        )
        return
      }

      // Sign out so the new password is actually exercised on the next login, instead of
      // silently continuing on the recovery session.
      await supabase.auth.signOut()
      setPhase("done")
    })
  }

  if (phase === "checking") {
    return <p className="py-4 text-center text-sm text-muted-foreground">Validando o link...</p>
  }

  if (phase === "invalid") {
    return (
      <div className="grid gap-3 text-center">
        <span
          className="mx-auto flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive"
          aria-hidden
        >
          <AlertTriangle className="size-5" />
        </span>
        <p className="text-sm font-medium">Link inválido ou expirado</p>
        <p className="text-[0.82rem] text-muted-foreground">
          Links de recuperação valem por tempo limitado e só podem ser usados uma vez.
        </p>
        <Button variant="outline" className="mt-1" render={<Link href="/recuperar-senha">Solicitar novo link</Link>} />
      </div>
    )
  }

  if (phase === "done") {
    return (
      <div className="grid gap-3 text-center" role="status">
        <span
          className="mx-auto flex size-10 items-center justify-center rounded-full bg-status-success/12 text-status-success"
          aria-hidden
        >
          <CheckCircle2 className="size-5" />
        </span>
        <p className="text-sm font-medium">Senha alterada</p>
        <p className="text-[0.82rem] text-muted-foreground">
          Entre novamente com a nova senha.
        </p>
        <Button className="mt-1" onClick={() => router.push("/login")}>
          Ir para o login
        </Button>
      </div>
    )
  }

  return (
    <form action={submit} className="grid gap-4">
      <PasswordField
        name="password"
        label="Nova senha"
        hint="Ao menos 8 caracteres."
        minLength={8}
        required
        autoFocus
      />

      <PasswordField
        name="confirm"
        label="Confirmar nova senha"
        minLength={8}
        required
      />

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" className="h-10 w-full" disabled={isPending}>
        {isPending ? "Salvando..." : "Definir nova senha"}
      </Button>
    </form>
  )
}
