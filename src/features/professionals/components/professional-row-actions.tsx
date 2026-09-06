"use client"

import { Pencil, Power } from "lucide-react"

import { RowActions, type RowAction } from "@/components/shared/row-actions"
import { ToggleActiveButton } from "@/components/shared/toggle-active-button"
import type { Database } from "@/types/supabase"
import { setProfessionalActiveAction } from "../actions/professional.actions"
import { EditProfessionalDialog } from "./edit-professional-dialog"

type Professional = Database["public"]["Tables"]["professionals"]["Row"]

/**
 * Ações da linha, recolhidas num menu. Componente de cliente próprio porque `RowActions`
 * recebe funções de renderização, e função não atravessa a fronteira servidor→cliente.
 */
export function ProfessionalRowActions({
  professional,
  specialties,
}: {
  professional: Professional
  specialties: { id: string; name: string }[]
}) {
  const actions: RowAction[] = [
    {
      key: "edit",
      label: "Editar",
      icon: Pencil,
      render: (control) => (
        <EditProfessionalDialog
          professional={professional}
          specialties={specialties}
          {...control}
        />
      ),
    },
    {
      key: "toggle",
      label: professional.active ? "Inativar" : "Ativar",
      icon: Power,
      danger: professional.active,
      render: (control) => (
        <ToggleActiveButton
          active={professional.active}
          activateLabel="Ativar"
          deactivateLabel="Inativar"
          confirmTitle={professional.active ? "Inativar profissional?" : "Ativar profissional?"}
          confirmDescription={
            professional.active
              ? "O profissional deixará de aparecer para novos agendamentos."
              : "O profissional voltará a aparecer para novos agendamentos."
          }
          action={setProfessionalActiveAction.bind(
            null,
            professional.id,
            !professional.active
          )}
          {...control}
        />
      ),
    },
  ]

  return <RowActions actions={actions} label={`Ações de ${professional.full_name}`} />
}
