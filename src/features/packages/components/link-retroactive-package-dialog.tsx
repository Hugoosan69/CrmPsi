"use client"

import { useActionState, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCloseOnSuccess } from "@/hooks/use-close-on-success"
import {
  linkRetroactiveSessionAction,
  listPatientPackagesForLinkAction,
  type PackageActionState,
} from "../actions/package.actions"

const initialState: PackageActionState = {}

type PackageOption = { id: string; label: string; suggestedSessionNumber: number }

/**
 * Requisito 6: lançamentos antigos de R$ 1,00 ou menos eram, na prática, sessões de
 * pacote lançadas como avulso. Este diálogo liga um desses lançamentos a um pacote real
 * do paciente, numa posição sugerida (`sessions_used + 1`, ajustável) — e cancela o
 * lançamento fantasma (some da receita, mas fica no histórico para auditoria).
 */
export function LinkRetroactivePackageDialog({
  transactionId,
  patientId,
}: {
  transactionId: string
  patientId: string | null
}) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<PackageOption[]>([])
  const [selectedPackage, setSelectedPackage] = useState("")
  const [sessionNumber, setSessionNumber] = useState(1)
  const [state, formAction, isPending] = useActionState(linkRetroactiveSessionAction, initialState)

  useCloseOnSuccess(state, Boolean(state.success), () => setOpen(false))

  useEffect(() => {
    if (!open || !patientId) return
    listPatientPackagesForLinkAction(patientId).then((packages) => {
      setOptions(packages)
      if (packages[0]) {
        setSelectedPackage(packages[0].id)
        setSessionNumber(packages[0].suggestedSessionNumber)
      }
    })
  }, [open, patientId])

  if (!patientId) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm">Vincular a um pacote</Button>} />
      <DialogContent className="max-w-md">
        <form action={formAction}>
          <input type="hidden" name="transaction_id" value={transactionId} />
          <DialogHeader>
            <DialogTitle>Vincular a um pacote</DialogTitle>
            <DialogDescription>
              Marca este lançamento como uma sessão de pacote em vez de avulso. O lançamento
              original é cancelado — o valor real já está no pacote.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {options.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este paciente não tem pacote ativo ainda. Venda um pacote na ficha dele antes de
                vincular esta sessão.
              </p>
            ) : (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="patient_package_id">Pacote</Label>
                  <Select
                    name="patient_package_id"
                    value={selectedPackage}
                    onValueChange={(v) => {
                      const value = v ?? ""
                      setSelectedPackage(value)
                      const pkg = options.find((o) => o.id === value)
                      if (pkg) setSessionNumber(pkg.suggestedSessionNumber)
                    }}
                  >
                    <SelectTrigger id="patient_package_id" className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="session_number">Posição da sessão</Label>
                  <Input
                    id="session_number"
                    name="session_number"
                    type="number"
                    min={1}
                    value={sessionNumber}
                    onChange={(e) => setSessionNumber(Number(e.target.value))}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Sugestão automática — ajuste se a ordem real for outra.
                  </p>
                </div>
              </>
            )}
          </div>
          {state.error ? (
            <p className="mb-3 text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || options.length === 0}>
              {isPending ? "Vinculando..." : "Vincular"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
