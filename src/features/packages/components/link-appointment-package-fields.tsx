"use client"

import { useEffect, useState } from "react"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getAppointmentPackageOptionsAction } from "../actions/package.actions"

type PackageOption = {
  id: string
  name: string
  totalSessions: number
  /** Posições já registradas — não podem ser escolhidas de novo. */
  taken: number[]
}

type Options = {
  patientPackages: PackageOption[]
  catalog: PackageOption[]
}

/**
 * Campos do vínculo de um agendamento a um pacote — uma correção de registro, não uma
 * venda: a consulta já estava marcada e o pacote já foi pago, o que faltava era o sistema
 * saber disso. Por isso não há forma de pagamento nem valor aqui.
 *
 * Dois campos, e não um: o pacote e QUAL sessão dele é esta consulta. Quem está acertando
 * o histórico sabe que "essa foi a terceira" — deixar o sistema numerar sozinho obrigaria
 * a registrar tudo em ordem. As posições já usadas ficam de fora da lista (e o índice
 * único de migrations/018 recusa a repetição, se a tela estiver desatualizada).
 *
 * Sem Dialog próprio: quem abre isto é o modo `link_package` do AppointmentDetailDialog,
 * e empilhar um Dialog dentro do outro deixa as duas camadas visíveis ao mesmo tempo.
 */
export function LinkAppointmentPackageFields({ appointmentId }: { appointmentId: string }) {
  const [options, setOptions] = useState<Options | null>(null)
  const [mode, setMode] = useState<"existing" | "new">("existing")
  const [selectedPackageId, setSelectedPackageId] = useState("")
  const [sessionNumber, setSessionNumber] = useState("")

  useEffect(() => {
    getAppointmentPackageOptionsAction(appointmentId).then((loaded) => {
      setOptions(loaded)
      setMode(loaded.patientPackages.length > 0 ? "existing" : "new")
    })
  }, [appointmentId])

  if (!options) {
    return <p className="py-4 text-sm text-muted-foreground">Carregando pacotes...</p>
  }

  const usingExisting = mode === "existing" && options.patientPackages.length > 0
  const list = usingExisting ? options.patientPackages : options.catalog
  const selected = list.find((p) => p.id === selectedPackageId) ?? null

  const availableSessions = selected
    ? Array.from({ length: selected.totalSessions }, (_, i) => i + 1).filter(
        (n) => !selected.taken.includes(n)
      )
    : []

  function pickPackage(value: string | null) {
    const id = value ?? ""
    setSelectedPackageId(id)
    // Sugere a primeira posição livre; a pessoa troca se a consulta foi outra.
    const pkg = list.find((p) => p.id === id)
    const firstFree = pkg
      ? Array.from({ length: pkg.totalSessions }, (_, i) => i + 1).find(
          (n) => !pkg.taken.includes(n)
        )
      : undefined
    setSessionNumber(firstFree ? String(firstFree) : "")
  }

  function switchMode(value: string | null) {
    setMode((value ?? "existing") as "existing" | "new")
    setSelectedPackageId("")
    setSessionNumber("")
  }

  return (
    <div className="grid gap-4 py-4">
      {options.patientPackages.length > 0 && (
        <div className="grid gap-1.5">
          <Label>Origem</Label>
          <Select value={mode} onValueChange={switchMode}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="existing">Pacote que o paciente já tem</SelectItem>
              <SelectItem value="new">Cadastrar outro pacote do paciente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {!usingExisting && options.patientPackages.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Este paciente ainda não tem pacote cadastrado. Escolha qual pacote ele comprou — o
          saldo é criado agora, sem gerar cobrança.
        </p>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="package_select">Pacote</Label>
        <Select
          name={usingExisting ? "patient_package_id" : "session_package_id"}
          value={selectedPackageId}
          onValueChange={pickPackage}
          required
        >
          <SelectTrigger id="package_select" className="w-full">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {list.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="session_number">Qual sessão é esta</Label>
        <Select
          name="session_number"
          value={sessionNumber}
          onValueChange={(v) => setSessionNumber(v ?? "")}
          disabled={!selected}
          required
        >
          <SelectTrigger id="session_number" className="w-full">
            <SelectValue placeholder={selected ? "Selecione" : "Escolha o pacote primeiro"} />
          </SelectTrigger>
          <SelectContent>
            {availableSessions.map((n) => (
              <SelectItem key={n} value={String(n)}>
                Sessão {n} de {selected?.totalSessions}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected && selected.taken.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Já registradas: {selected.taken.sort((a, b) => a - b).join(", ")}.
          </p>
        )}
        {selected && availableSessions.length === 0 && (
          <p className="text-xs text-destructive">
            Todas as sessões deste pacote já foram registradas.
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Nenhuma cobrança é lançada aqui — o pagamento do pacote já foi feito.
      </p>
    </div>
  )
}
