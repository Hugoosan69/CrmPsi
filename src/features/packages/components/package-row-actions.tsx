"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Power, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { RowActions, type RowAction } from "@/components/shared/row-actions"
import { ToggleActiveButton } from "@/components/shared/toggle-active-button"
import type { SessionPackageView } from "@/services/packages.service"
import { reprocessPackageBalancesAction, setSessionPackageActiveAction } from "../actions/package.actions"
import { EditPackageDialog } from "./edit-package-dialog"

/**
 * Ações da linha do catálogo de pacotes.
 *
 * O reprocessamento é ação direta, sem diálogo: ele não pergunta nada, só relata pelo toast
 * o que alinhou (vínculos, saldos e lançamentos). Por isso entra como `onSelect` em vez de
 * `render`.
 */
export function PackageRowActions({
  sessionPackage,
  specialties,
}: {
  sessionPackage: SessionPackageView
  specialties: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function reprocess() {
    startTransition(async () => {
      const result = await reprocessPackageBalancesAction(sessionPackage.id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(result.message ?? "Pacote reprocessado.")
      router.refresh()
    })
  }

  const actions: RowAction[] = [
    {
      key: "edit",
      label: "Editar",
      icon: Pencil,
      render: (control) => (
        <EditPackageDialog
          sessionPackage={sessionPackage}
          specialties={specialties}
          {...control}
        />
      ),
    },
    {
      key: "reprocess",
      label: isPending ? "Reprocessando..." : "Reprocessar saldos e financeiro",
      icon: RefreshCw,
      disabled: isPending,
      onSelect: reprocess,
    },
    {
      key: "toggle",
      label: sessionPackage.active ? "Inativar" : "Ativar",
      icon: Power,
      danger: sessionPackage.active,
      render: (control) => (
        <ToggleActiveButton
          active={sessionPackage.active}
          activateLabel="Ativar"
          deactivateLabel="Inativar"
          confirmTitle={sessionPackage.active ? "Inativar pacote?" : "Ativar pacote?"}
          confirmDescription={
            sessionPackage.active
              ? "O pacote deixará de aparecer para novas vendas."
              : "O pacote voltará a aparecer para novas vendas."
          }
          action={setSessionPackageActiveAction.bind(
            null,
            sessionPackage.id,
            !sessionPackage.active
          )}
          {...control}
        />
      ),
    },
  ]

  return <RowActions actions={actions} label={`Ações de ${sessionPackage.name}`} />
}
