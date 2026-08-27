"use client"

import { useActionState } from "react"
import { MailCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { requestPasswordResetAction, type ResetRequestState } from "./actions"

const initialState: ResetRequestState = {}

export function ResetRequestForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, initialState)

  if (state.sent) {
    return (
      <div className="grid gap-3 text-center" role="status">
        <span
          className="mx-auto flex size-10 items-center justify-center rounded-full bg-status-success/12 text-status-success"
          aria-hidden
        >
          <MailCheck className="size-5" />
        </span>
        <p className="text-sm font-medium">Link enviado</p>
        <p className="text-[0.82rem] text-muted-foreground">
          Se existir uma conta com esse e-mail, o link para definir a nova senha chegará em
          instantes. Verifique também a caixa de spam.
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="reset-email">E-mail</Label>
        <Input
          id="reset-email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="voce@csib.com.br"
          required
          autoFocus
        />
      </div>

      {state.error && (
        <p
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      )}

      <Button type="submit" className="h-10 w-full" disabled={isPending}>
        {isPending ? "Enviando..." : "Enviar link de recuperação"}
      </Button>
    </form>
  )
}
