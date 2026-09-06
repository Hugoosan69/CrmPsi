"use client"

import { Pencil, Power } from "lucide-react"

import { RowActions, type RowAction } from "@/components/shared/row-actions"
import { ToggleActiveButton } from "@/components/shared/toggle-active-button"
import type { Database } from "@/types/supabase"
import { setPatientActiveAction } from "../actions/patient.actions"
import { EditPatientDialog } from "./edit-patient-dialog"

type Patient = Database["public"]["Tables"]["patients"]["Row"]

/**
 * Ações da linha, recolhidas num menu. Componente de cliente próprio porque `RowActions`
 * recebe funções de renderização, e função não atravessa a fronteira servidor→cliente —
 * a tabela em si continua sendo componente de servidor.
 */
export function PatientRowActions({ patient }: { patient: Patient }) {
  const actions: RowAction[] = [
    {
      key: "edit",
      label: "Editar cadastro",
      icon: Pencil,
      render: (control) => <EditPatientDialog patient={patient} {...control} />,
    },
    {
      key: "toggle",
      label: patient.active ? "Inativar" : "Ativar",
      icon: Power,
      danger: patient.active,
      render: (control) => (
        <ToggleActiveButton
          active={patient.active}
          activateLabel="Ativar"
          deactivateLabel="Inativar"
          confirmTitle={patient.active ? "Inativar paciente?" : "Ativar paciente?"}
          confirmDescription={
            patient.active
              ? "O paciente deixará de aparecer nas buscas e listagens padrão."
              : "O paciente voltará a aparecer nas buscas e listagens padrão."
          }
          action={setPatientActiveAction.bind(null, patient.id, !patient.active)}
          {...control}
        />
      ),
    },
  ]

  return (
    <RowActions actions={actions} label={`Ações de ${patient.social_name || patient.full_name}`} />
  )
}
