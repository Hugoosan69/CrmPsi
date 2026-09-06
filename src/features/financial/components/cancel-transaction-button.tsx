"use client"

import { useTransition } from "react"

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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useDialogOpen, type DialogOpenProps } from "@/hooks/use-dialog-open"
import { cancelTransactionAction } from "../actions/financial.actions"

export function CancelTransactionButton({
  transactionId,
  ...dialogProps
}: { transactionId: string } & DialogOpenProps) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useDialogOpen(dialogProps)

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {!dialogProps.hideTrigger && (
        <AlertDialogTrigger render={<Button variant="ghost" size="sm">Cancelar</Button>} />
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar lançamento?</AlertDialogTitle>
          <AlertDialogDescription>Esta ação marca o lançamento como cancelado.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={() => startTransition(() => cancelTransactionAction(transactionId))}
          >
            Confirmar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
