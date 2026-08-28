"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PasswordField } from "@/components/ui/password-field"
import { createAuthCallbackClient, createClient } from "@/lib/supabase/client"
import { newPasswordSchema } from "@/schemas/auth.schema"

type Phase = "checking" | "ready" | "invalid" | "done"

/**
 * Recovery has to be handled in the browser, and the URL has to be read by hand.
 *
 * Two separate reasons, both learned the hard way:
 *
 * 1. The token arrives in the URL *fragment* (`#access_token=…&type=recovery`), which is
 *    never sent to the server — a Server Component literally cannot see it.
 *
 * 2. The automatic path (`detectSessionInUrl`) does NOT work here. `createBrowserClient`
 *    defaults to `flowType: 'pkce'`, and GoTrueClient throws "Not a valid PKCE flow url."
 *    the moment a PKCE-configured client meets an implicit-grant fragment. The error is
 *    swallowed internally, so the only symptom is `getSession()` returning null and this
 *    screen reporting a perfectly valid link as expired.
 *
 * Which shape Supabase sends — `#access_token=…` (implicit) or `?code=…` (PKCE) — is a
 * property of the project's configuration, not of what this client requests. So both are
 * handled explicitly instead of betting on one.
 */
export function NewPasswordForm() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("checking")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    const supabase = createAuthCallbackClient()

    async function consumeCallback() {
      const hash = new URLSearchParams(window.location.hash.slice(1))
      const query = new URLSearchParams(window.location.search)

      // An expired or already-used link comes back as an error instead of a token.
      if (hash.get("error") || query.get("error")) return false

      const accessToken = hash.get("access_token")
      const refreshToken = hash.get("refresh_token")
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        return !error
      }

      const code = query.get("code")
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        return !error
      }

      // No callback in the URL — but the session may already be established, which is what
      // happens when this effect re-runs (React Strict Mode does so in development) after a
      // previous pass consumed and cleared the token.
      const { data } = await supabase.auth.getSession()
      return Boolean(data.session)
    }

    void consumeCallback().then((ok) => {
      if (cancelled) return
      setPhase(ok ? "ready" : "invalid")
      if (ok) {
        // Clear the credential out of the address bar once it has been exchanged: it stays
        // in history, gets copied with the URL and leaks through the referrer otherwise.
        window.history.replaceState(null, "", window.location.pathname)
      }
    })

    return () => {
      cancelled = true
    }
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
