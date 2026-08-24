"use client"

import { useRouter } from "next/navigation"
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
import { finishServiceAction } from "../actions/service.actions"

export function FinishServiceButton({ queueEntryId }: { queueEntryId: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="default">Finalizar atendimento</Button>} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Finalizar atendimento?</AlertDialogTitle>
          <AlertDialogDescription>
            O cronômetro para e o paciente sai da fila como concluído. Você ainda pode consultar
            este atendimento no histórico do paciente depois.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await finishServiceAction(queueEntryId)
                router.push("/profissional/fila")
              })
            }
          >
            {isPending ? "Finalizando..." : "Finalizar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
