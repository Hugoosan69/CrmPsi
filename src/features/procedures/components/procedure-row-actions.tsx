"use client"

import { Pencil, Power } from "lucide-react"

import { RowActions, type RowAction } from "@/components/shared/row-actions"
import { ToggleActiveButton } from "@/components/shared/toggle-active-button"
import type { Database } from "@/types/supabase"
import { setProcedureActiveAction } from "../actions/procedure.actions"
import { EditProcedureDialog } from "./edit-procedure-dialog"

/**
 * Ações da linha, recolhidas num menu. Componente de cliente próprio porque `RowActions`
 * recebe funções de renderização, e função não atravessa a fronteira servidor→cliente —
 * a tabela em si continua sendo componente de servidor.
 */
export function ProcedureRowActions({ procedure }: { procedure: Database["public"]["Tables"]["procedures"]["Row"] }) {
  const actions: RowAction[] = [
    {
      key: "edit",
      label: "Editar",
      icon: Pencil,
      render: (control) => <EditProcedureDialog procedure={procedure} {...control} />,
    },
    {
      key: "toggle",
      label: procedure.active ? "Inativar" : "Ativar",
      icon: Power,
      danger: procedure.active,
      render: (control) => (
        <ToggleActiveButton
          active={procedure.active}
          activateLabel="Ativar"
          deactivateLabel="Inativar"
          confirmTitle={procedure.active ? "Inativar procedimento?" : "Ativar procedimento?"}
          confirmDescription={
            procedure.active
              ? "O procedimento deixará de aparecer para novos agendamentos."
              : "O procedimento voltará a aparecer para novos agendamentos."
          }
          action={setProcedureActiveAction.bind(null, procedure.id, !procedure.active)}
          {...control}
        />
      ),
    },
  ]

  return <RowActions actions={actions} label={`Ações de ${procedure.name}`} />
}
