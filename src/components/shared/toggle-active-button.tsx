"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

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

export function ToggleActiveButton({
  active,
  activateLabel = "Ativar",
  deactivateLabel = "Desativar",
  confirmTitle,
  confirmDescription,
  action,
}: {
  active: boolean
  activateLabel?: string
  deactivateLabel?: string
  confirmTitle: string
  confirmDescription: string
  action: () => Promise<void>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  /**
   * Fecha o diálogo só depois que a ação termina.
   *
   * `AlertDialogAction` é um botão comum, não um `Close` — sozinho ele não fecha nada. Sem
   * este controle, o `revalidatePath` da ação voltava com a linha já invertida e o diálogo
   * continuava aberto perguntando o contrário ("Ativar?" logo após ativar), como se
   * oferecesse desfazer. Aguardar a ação também mantém o "Confirmar" desabilitado enquanto
   * o servidor trabalha, em vez de fechar na hora e deixar a tela mentir por um instante.
   *
   * O `router.refresh()` é o cinto de segurança: o `revalidatePath` do lado do servidor
   * quase sempre já devolve a linha atualizada, mas foi visto voltar com o estado antigo
   * (a linha continuava "Inativo" depois de ativar). Uma tela que mostra o contrário do
   * que acabou de acontecer é pior do que uma releitura a mais.
   */
  function confirm() {
    startTransition(async () => {
      await action()
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="sm">
            {active ? deactivateLabel : activateLabel}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={confirm}>
            {isPending ? "Salvando..." : "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
