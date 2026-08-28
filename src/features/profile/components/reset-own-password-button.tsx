"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { sendOwnPasswordResetAction } from "../actions/profile.actions"

/**
 * Manda o link de redefinição para o próprio e-mail, sem sair da tela.
 *
 * O resultado aparece aqui mesmo em vez de num toast: a pessoa precisa ver PARA QUAL
 * endereço o link foi, e um aviso que some em três segundos não serve para isso.
 */
export function ResetOwnPasswordButton() {
  const [isPending, start] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  if (message?.ok) {
    return (
      <p className="text-[0.8rem] text-status-success" role="status">
        {message.text}
      </p>
    )
  }

  return (
    <div className="grid gap-1.5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isPending}
        className="h-auto justify-self-start px-0 text-[0.8rem] font-normal text-muted-foreground underline underline-offset-2 hover:bg-transparent hover:text-foreground"
        onClick={() =>
          start(async () => {
            const result = await sendOwnPasswordResetAction()
            setMessage(
              result.error
                ? { ok: false, text: result.error }
                : { ok: true, text: result.success ?? "Link enviado." }
            )
          })
        }
      >
        {isPending ? "Enviando..." : "Não lembro a senha atual"}
      </Button>
      {message && !message.ok && (
        <p className="text-[0.8rem] text-destructive" role="alert">
          {message.text}
        </p>
      )}
    </div>
  )
}
