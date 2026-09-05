"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { reprocessPackageBalancesAction } from "../actions/package.actions"

/**
 * Alinha os pacotes já vendidos ao que o catálogo diz hoje.
 *
 * Salvar o cadastro já reprocessa sozinho — este botão é para o desencontro que não veio de
 * uma edição: pacotes criados na conversão retroativa, importados, ou ajustados direto no
 * banco, que ficaram com o número de sessões antigo na agenda e na ficha do paciente.
 */
export function ReprocessBalancesButton({ packageId }: { packageId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function reprocess() {
    startTransition(async () => {
      const result = await reprocessPackageBalancesAction(packageId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(result.message ?? "Saldos reprocessados.")
      router.refresh()
    })
  }

  return (
    <Button variant="ghost" size="sm" onClick={reprocess} disabled={isPending}>
      <RefreshCw aria-hidden />
      {isPending ? "Reprocessando..." : "Reprocessar saldos"}
    </Button>
  )
}
