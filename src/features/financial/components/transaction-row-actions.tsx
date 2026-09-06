"use client"

import { Ban, Info, Layers, Pencil, Wallet } from "lucide-react"

import { RowActions, type RowAction } from "@/components/shared/row-actions"
import type { TransactionView } from "@/services/financial.service"
import { RegisterPaymentDialog } from "./register-payment-dialog"
import { CancelTransactionButton } from "./cancel-transaction-button"
import { EditAmountDialog } from "./edit-amount-dialog"
import { TransactionDetailDialog } from "./transaction-detail-dialog"
import { LinkRetroactivePackageDialog } from "@/features/packages/components/link-retroactive-package-dialog"

type PaymentMethod = { id: string; name: string }

/**
 * As ações de uma linha do financeiro, recolhidas num menu.
 *
 * Fica em componente de cliente próprio porque `RowActions` recebe funções de renderização,
 * e função não atravessa a fronteira servidor→cliente — a tabela em si continua sendo
 * componente de servidor.
 */
export function TransactionRowActions({
  transaction: t,
  label,
  paymentMethods,
  canManage,
  canEditAmount,
  canEditPaid,
}: {
  transaction: TransactionView
  label: string
  paymentMethods: PaymentMethod[]
  canManage: boolean
  canEditAmount: boolean
  canEditPaid: boolean
}) {
  const emAberto = t.status === "pendente" || t.status === "atrasado"
  const actions: RowAction[] = [
    {
      key: "detail",
      label: "Ver detalhes",
      icon: Info,
      render: (control) => (
        <TransactionDetailDialog transactionId={t.id} label={label} {...control} />
      ),
    },
  ]

  if (canManage && emAberto) {
    actions.push({
      key: "pay",
      label: "Registrar pagamento",
      icon: Wallet,
      render: (control) => (
        <RegisterPaymentDialog
          transactionId={t.id}
          amount={Number(t.amount)}
          paymentMethods={paymentMethods}
          {...control}
        />
      ),
    })
  }

  // Requisito 6: lançamentos de R$ 1 ou menos são, por definição, sessões de pacote
  // lançadas como avulso — ver database/migrations/015. Some assim que a linha já está
  // vinculada a um pacote.
  if (canManage && !t.isPackage && t.status !== "cancelado" && Number(t.amount) <= 1) {
    actions.push({
      key: "link",
      label: "Vincular a um pacote",
      icon: Layers,
      render: (control) => (
        <LinkRetroactivePackageDialog
          transactionId={t.id}
          patientId={t.patient_id}
          {...control}
        />
      ),
    })
  }

  // Linha paga só é editável por quem tem as DUAS permissões — a Server Action confere de
  // novo, isto aqui é só não oferecer o que vai ser recusado.
  if (canEditAmount && t.status !== "cancelado" && (t.status !== "pago" || canEditPaid)) {
    actions.push({
      key: "amount",
      label: "Corrigir valor",
      icon: Pencil,
      render: (control) => (
        <EditAmountDialog
          transactionId={t.id}
          amount={Number(t.amount)}
          description={t.description}
          isPaid={t.status === "pago"}
          {...control}
        />
      ),
    })
  }

  if (canManage && emAberto) {
    actions.push({
      key: "cancel",
      label: "Cancelar lançamento",
      icon: Ban,
      danger: true,
      render: (control) => <CancelTransactionButton transactionId={t.id} {...control} />,
    })
  }

  return <RowActions actions={actions} label={`Ações de ${label}`} />
}
