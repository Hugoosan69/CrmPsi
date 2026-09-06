"use client"

import { Pencil, Power } from "lucide-react"

import { RowActions, type RowAction } from "@/components/shared/row-actions"
import { ToggleActiveButton } from "@/components/shared/toggle-active-button"
import type { BillingTypeView } from "@/services/billing.service"
import { setBillingTypeActiveAction } from "../actions/billing.actions"
import { EditBillingTypeDialog } from "./edit-billing-type-dialog"

export function BillingTypeRowActions({ billingType }: { billingType: BillingTypeView }) {
  const emUso = billingType.authorizationsInUse > 0

  const actions: RowAction[] = [
    {
      key: "edit",
      label: "Editar",
      icon: Pencil,
      render: (control) => <EditBillingTypeDialog billingType={billingType} {...control} />,
    },
    {
      key: "toggle",
      label: billingType.active ? "Inativar" : "Ativar",
      icon: Power,
      danger: billingType.active,
      render: (control) => (
        <ToggleActiveButton
          active={billingType.active}
          activateLabel="Ativar"
          deactivateLabel="Inativar"
          confirmTitle={
            billingType.active ? "Inativar tipo de cobrança?" : "Ativar tipo de cobrança?"
          }
          confirmDescription={
            billingType.active
              ? emUso
                ? `Há ${billingType.authorizationsInUse} autorização(ões) usando este tipo. Elas continuam valendo — ele só deixa de aparecer para novos atendimentos.`
                : "Ele deixará de aparecer como opção em novos atendimentos."
              : "Ele voltará a aparecer como opção em novos atendimentos."
          }
          action={setBillingTypeActiveAction.bind(null, billingType.id, !billingType.active)}
          {...control}
        />
      ),
    },
  ]

  return <RowActions actions={actions} label={`Ações de ${billingType.name}`} />
}
