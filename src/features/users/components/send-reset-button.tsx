"use client"

import { useState, useTransition } from "react"
import { KeyRound } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { sendPasswordResetForMemberAction } from "../actions/user.actions"

/**
 * Lets an admin start the recovery flow for a colleague who is locked out.
 *
 * Confirmed rather than fired on click because it sends real mail to a real person — an
 * accidental click should not land an unexpected "redefina sua senha" in someone's inbox,
 * which reads like a phishing attempt or a break-in.
 */
export function SendResetButton({
  membershipId,
  memberName,
  memberEmail,
}: {
  membershipId: string
  memberName: string
  memberEmail: string
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function send() {
    startTransition(async () => {
      const result = await sendPasswordResetForMemberAction(membershipId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Link de redefinição enviado para ${memberEmail}.`)
      setOpen(false)
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Enviar link de redefinição de senha para ${memberName}`}
      >
        <KeyRound className="size-3.5" />
        <span className="sr-only sm:not-sr-only sm:ml-1.5">Redefinir senha</span>
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar link de redefinição?</AlertDialogTitle>
            <AlertDialogDescription>
              {memberName} receberá um e-mail em {memberEmail} com um link para definir uma nova
              senha. O link expira e só pode ser usado uma vez. A senha atual continua válida
              até que a nova seja definida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                // The dialog closes on its own action click; kept open so the pending state
                // is visible and a failure can be reported in place.
                event.preventDefault()
                send()
              }}
              disabled={isPending}
            >
              {isPending ? "Enviando..." : "Enviar link"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
