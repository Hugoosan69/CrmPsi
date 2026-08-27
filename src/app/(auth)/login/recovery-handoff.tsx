"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"

/**
 * Rescues a password-recovery return that landed on /login instead of /redefinir-senha.
 *
 * Why this is needed: Supabase only honours `redirectTo` when that exact URL is listed under
 * Authentication → URL Configuration → Redirect URLs. When it is not, it silently falls back
 * to Site URL — usually the deploy root — and the proxy then bounces the session-less
 * request to /login. Crucially the URL *fragment* survives an HTTP redirect, so the recovery
 * token is still sitting in `window.location.hash` when we get here.
 *
 * So rather than depending on a dashboard setting being right, the token is handed off to the
 * screen that knows what to do with it. The fragment is forwarded byte-for-byte, because the
 * Supabase client on the target page has to parse it itself.
 */
export function RecoveryHandoff() {
  const [linkError, setLinkError] = useState<string | null>(null)

  useEffect(() => {
    const raw = window.location.hash.slice(1) || window.location.search.slice(1)
    if (!raw) return

    const params = new URLSearchParams(raw)

    // Forwarded first and synchronously, so the login form flashes for as little as
    // possible. `type=recovery` is what distinguishes this from a normal sign-in callback.
    if (params.get("type") === "recovery" && (params.has("access_token") || params.has("code"))) {
      window.location.replace(`/redefinir-senha#${raw}`)
      return
    }

    // A failed recovery comes back as `#error=...&error_code=otp_expired`. Reported here
    // rather than forwarded: an error fragment carries no token, and it is not necessarily
    // from a recovery link, so guessing would mislabel it.
    if (params.has("error") || params.has("error_code")) {
      const code = params.get("error_code")
      // Deferred rather than set synchronously in the effect body — same reason as the
      // stored-preference read in components/layout/app-shell.tsx. The value can only be
      // read client-side, so the server pass renders nothing and this corrects it in a
      // browser-only tick.
      const id = setTimeout(() => {
        setLinkError(
          code === "otp_expired"
            ? "O link expirou. Links de recuperação valem por tempo limitado."
            : "O link não pôde ser validado. Ele pode já ter sido usado."
        )
        // Clear the fragment so a refresh does not re-show a stale error.
        window.history.replaceState(null, "", window.location.pathname)
      }, 0)
      return () => clearTimeout(id)
    }
  }, [])

  if (!linkError) return null

  return (
    <div
      className="mb-4 grid gap-2 rounded-lg border border-status-warning/40 bg-status-warning/5 px-3.5 py-3"
      role="alert"
    >
      <div className="flex gap-2.5">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-warning" aria-hidden />
        <p className="text-[0.82rem] text-muted-foreground">{linkError}</p>
      </div>
      <Link
        href="/recuperar-senha"
        className="pl-6.5 text-[0.8rem] font-medium underline underline-offset-2"
      >
        Solicitar um novo link
      </Link>
    </div>
  )
}
