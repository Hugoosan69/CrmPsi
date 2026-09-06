"use client"

import { Pencil, Power } from "lucide-react"

import { RowActions, type RowAction } from "@/components/shared/row-actions"
import { ToggleActiveButton } from "@/components/shared/toggle-active-button"
import type { Database } from "@/types/supabase"
import { setMessageTemplateActiveAction } from "../actions/communication.actions"
import { EditMessageTemplateDialog } from "./edit-message-template-dialog"

/**
 * Ações da linha, recolhidas num menu. Componente de cliente próprio porque `RowActions`
 * recebe funções de renderização, e função não atravessa a fronteira servidor→cliente —
 * a tabela em si continua sendo componente de servidor.
 */
export function MessageTemplateRowActions({ template }: { template: Database["public"]["Tables"]["message_templates"]["Row"] }) {
  const actions: RowAction[] = [
    {
      key: "edit",
      label: "Editar",
      icon: Pencil,
      render: (control) => <EditMessageTemplateDialog template={template} {...control} />,
    },
    {
      key: "toggle",
      label: template.active ? "Inativar" : "Ativar",
      icon: Power,
      danger: template.active,
      render: (control) => (
        <ToggleActiveButton
          active={template.active}
          activateLabel="Ativar"
          deactivateLabel="Inativar"
          confirmTitle={template.active ? "Inativar modelo?" : "Ativar modelo?"}
          confirmDescription={
            template.active
              ? "O modelo deixará de aparecer como opção ao enviar mensagens."
              : "O modelo voltará a aparecer como opção ao enviar mensagens."
          }
          action={setMessageTemplateActiveAction.bind(null, template.id, !template.active)}
          {...control}
        />
      ),
    },
  ]

  return <RowActions actions={actions} label="Ações do modelo" />
}
