"use client"

import { useEffect, useState, useTransition } from "react"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { listPatientActivePackagesAction } from "../actions/package.actions"

type PackageOption = { id: string; label: string; remaining: number }

/**
 * "Usar sessão do pacote" — aparece só quando o paciente escolhido tem pacote ativo com
 * saldo. Some silenciosamente (sem placeholder vazio) quando não há nenhum, para não
 * poluir o formulário no caso comum de atendimento avulso.
 */
export function PackageSessionField({
  patientId,
  defaultValue,
}: {
  patientId: string | null
  defaultValue?: string | null
}) {
  const [options, setOptions] = useState<PackageOption[]>([])
  const [value, setValue] = useState(defaultValue ?? "")
  const [isPending, startTransition] = useTransition()
  const [lastPatientId, setLastPatientId] = useState(patientId)

  // Reset síncrono durante a renderização quando o paciente muda — a mesma técnica de
  // useCloseOnSuccess (comparar contra o valor da renderização anterior via useState) para
  // não disparar o aviso de cascading render do react-hooks/set-state-in-effect: isto não é
  // sincronizar com um sistema externo, é limpar seleção obsoleta antes da busca.
  if (lastPatientId !== patientId) {
    setLastPatientId(patientId)
    setOptions([])
    setValue("")
  }

  useEffect(() => {
    if (!patientId) return
    startTransition(async () => {
      const packages = await listPatientActivePackagesAction(patientId)
      setOptions(packages)
    })
  }, [patientId])

  if (!patientId || (options.length === 0 && !isPending)) {
    return <input type="hidden" name="patient_package_id" value="" />
  }

  return (
    <div className="grid gap-1.5 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
      <Label htmlFor="patient_package_id">Usar sessão do pacote (opcional)</Label>
      <Select
        name="patient_package_id"
        value={value}
        onValueChange={(v) => setValue(v ?? "")}
      >
        <SelectTrigger id="patient_package_id" className="w-full bg-background">
          <SelectValue placeholder={isPending ? "Verificando pacotes..." : "Cobrança avulsa"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Cobrança avulsa</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.label} · {o.remaining} restante{o.remaining > 1 ? "s" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
