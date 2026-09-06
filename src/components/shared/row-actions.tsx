"use client"

import { Fragment, useState } from "react"
import { MoreHorizontal, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

/**
 * O que o item do menu entrega ao diálogo que ele abre: o diálogo não desenha gatilho
 * nenhum (o item do menu já é o gatilho) e quem manda no aberto/fechado é este menu.
 */
export type RowActionControl = {
  hideTrigger: true
  open: boolean
  onOpenChange: (open: boolean) => void
}

export type RowAction = {
  /** Identifica a ação dentro da linha. Único por menu. */
  key: string
  label: string
  icon?: LucideIcon
  /** Destrutiva ou irreversível: vai para o fim, depois de um separador, em vermelho. */
  danger?: boolean
  /** O diálogo desta ação. Recebe o controle e NÃO deve renderizar gatilho próprio. */
  render?: (control: RowActionControl) => React.ReactNode
  /** Ação que dispara direto, sem diálogo. Use uma OU `render`, nunca as duas. */
  onSelect?: () => void
  /** Desabilita o item sem tirá-lo do menu, quando a ação não cabe nesta linha. */
  disabled?: boolean
}

/**
 * Menu de ações de uma linha de tabela.
 *
 * Existe porque ação em botão solto não escala: a linha do financeiro chegou a cinco
 * botões de texto ("Detalhes", "Registrar pagamento", "Cancelar", "Vincular a um pacote",
 * "Corrigir valor"), e eram eles — não os dados — que obrigavam a tabela a rolar de lado.
 * Recolhidos num menu, a coluna de ações passa a ocupar a largura de um ícone, e a tabela
 * cabe na tela sem esconder nenhuma informação.
 *
 * O diálogo NÃO fica dentro do menu: o menu desmonta ao fechar e levaria o diálogo junto.
 * Aqui o item apenas anota qual ação foi escolhida, e os diálogos ficam fora, montados o
 * tempo todo, abrindo por `open`. Mesmo padrão que `AppointmentRowActions` já usava com
 * `AppointmentDetailDialog`.
 *
 * A abertura é adiada um tique porque o menu devolve o foco ao gatilho ao fechar, e esse
 * retorno de foco chegava depois do diálogo abrir — roubando dele o foco inicial.
 */
export function RowActions({
  actions,
  label = "Ações da linha",
}: {
  actions: RowAction[]
  label?: string
}) {
  const [openKey, setOpenKey] = useState<string | null>(null)

  const normais = actions.filter((a) => !a.danger)
  const perigosas = actions.filter((a) => a.danger)
  const ordenadas = [...normais, ...perigosas]

  if (ordenadas.length === 0) return null

  function select(action: RowAction) {
    // Adiado um tique: o menu devolve o foco ao gatilho ao fechar, e esse retorno chegava
    // depois do diálogo abrir, roubando dele o foco inicial.
    setTimeout(() => {
      if (action.onSelect) action.onSelect()
      else setOpenKey(action.key)
    }, 0)
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label={label}>
              <MoreHorizontal className="size-4" aria-hidden />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {normais.map((action) => (
            <DropdownMenuItem
              key={action.key}
              disabled={action.disabled}
              onClick={() => select(action)}
            >
              {action.icon && <action.icon className="size-4" aria-hidden />}
              {action.label}
            </DropdownMenuItem>
          ))}

          {perigosas.length > 0 && normais.length > 0 && <DropdownMenuSeparator />}

          {perigosas.map((action) => (
            <DropdownMenuItem
              key={action.key}
              disabled={action.disabled}
              onClick={() => select(action)}
              className={cn("text-destructive")}
            >
              {action.icon && <action.icon className="size-4" aria-hidden />}
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {ordenadas.map((action) => (
        <Fragment key={action.key}>
          {action.render?.({
            hideTrigger: true,
            open: openKey === action.key,
            onOpenChange: (open) => setOpenKey(open ? action.key : null),
          })}
        </Fragment>
      ))}
    </div>
  )
}
