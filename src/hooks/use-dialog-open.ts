"use client"

import { useState } from "react"

/**
 * Props que tornam um diálogo controlável por fora, sem perder o uso solto.
 *
 * `RowActions` precisa mandar no aberto/fechado (o item do menu é o gatilho), mas os mesmos
 * diálogos continuam sendo usados sozinhos, com gatilho próprio, fora de tabela. Estas três
 * props são todas opcionais: sem elas, o componente segue guardando o próprio estado.
 */
export type DialogOpenProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Não desenha gatilho — quem abre é quem controla. */
  hideTrigger?: boolean
}

/** `[open, setOpen]`, vindo de fora quando controlado e de dentro quando não. */
export function useDialogOpen({
  open,
  onOpenChange,
}: DialogOpenProps): [boolean, (open: boolean) => void] {
  const [selfOpen, setSelfOpen] = useState(false)
  return [open ?? selfOpen, onOpenChange ?? setSelfOpen]
}
