"use client"

import { useState } from "react"
import { Paperclip } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type Insurer = { id: string; name: string; amount_per_guide: number }
type PaymentMethod = { id: string; name: string }

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

/**
 * Os campos que descem quando a forma de pagamento é "Convênio".
 *
 * A conta que a tela faz por quem opera: **procedimento − o que o convênio paga = o que
 * sobra para o paciente**. Deixar esse número para a recepção calcular de cabeça, no
 * balcão, com o paciente esperando, é onde o erro entra — e um erro aqui vira cobrança a
 * menos que ninguém percebe até o fechamento do mês.
 *
 * O valor sugerido é editável de propósito: o combinado com o paciente pode ser outro, e o
 * sistema não deve fingir que sabe mais do que quem está atendendo.
 */
export function InsurerGuideFields({
  insurers,
  paymentMethods,
  procedureAmount,
}: {
  insurers: Insurer[]
  paymentMethods: PaymentMethod[]
  /** O valor que a cobrança tinha antes — o preço do procedimento. */
  procedureAmount: number
}) {
  const [insurerId, setInsurerId] = useState<string>(insurers[0]?.id ?? "")
  const [temAvulso, setTemAvulso] = useState(false)

  const convenio = insurers.find((i) => i.id === insurerId)
  const valorGuia = convenio ? Number(convenio.amount_per_guide) : 0
  const diferenca = Math.max(0, procedureAmount - valorGuia)

  if (insurers.length === 0) {
    return (
      <p className="rounded-md border border-status-warning/40 bg-status-warning/[0.06] px-3 py-2 text-[0.8rem]">
        Nenhum convênio cadastrado. Cadastre em Gestão › Pacotes e convênios antes de
        registrar uma guia.
      </p>
    )
  }

  return (
    <div className="grid gap-4 rounded-xl border border-border p-3">
      <div className="grid gap-1.5">
        <Label htmlFor="insurer_id">Convênio</Label>
        <Select
          name="insurer_id"
          value={insurerId}
          onValueChange={(v) => setInsurerId(v ?? "")}
          required
        >
          <SelectTrigger id="insurer_id" className="w-full">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {insurers.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.name} — {formatCurrency(Number(i.amount_per_guide))} por guia
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="guide_number">Número da guia</Label>
        <Input id="guide_number" name="guide_number" required placeholder="Como está no papel" />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="attachment" className="inline-flex items-center gap-1.5">
          <Paperclip className="size-3.5" aria-hidden />
          Anexar a guia <span className="text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id="attachment"
          name="attachment"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
        />
        <p className="text-[0.72rem] text-muted-foreground">
          PDF ou foto, até 8 MB. Fica guardada em local privado e aparece na ficha do
          paciente.
        </p>
      </div>

      {/* A conta, à vista, antes de decidir. */}
      <div className="grid gap-1 rounded-lg bg-muted/50 p-3 text-[0.8rem]">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Valor do atendimento</span>
          <span className="tabular-nums">{formatCurrency(procedureAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">O convênio paga</span>
          <span className="tabular-nums text-status-success">− {formatCurrency(valorGuia)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-1 font-medium">
          <span>Sobra para o paciente</span>
          <span className={cn("tabular-nums", diferenca > 0 && "text-status-warning")}>
            {formatCurrency(diferenca)}
          </span>
        </div>
      </div>

      <label className="flex items-start gap-2.5">
        <Checkbox
          name="has_extra_charge"
          checked={temAvulso}
          onCheckedChange={(v) => setTemAvulso(v === true)}
        />
        <span className="grid gap-0.5">
          <span className="text-[0.85rem] font-medium">Cobrar a diferença do paciente</span>
          <span className="text-[0.75rem] text-muted-foreground">
            Sem isto, o atendimento fica em R$ 0,00 para o paciente — só o convênio paga.
          </span>
        </span>
      </label>

      {temAvulso && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="amount">Valor avulso (R$)</Label>
            {/* Sugerido, não imposto: o combinado com o paciente pode ser outro. */}
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={diferenca > 0 ? diferenca.toFixed(2) : ""}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="extra_method">Forma do avulso</Label>
            <Select name="payment_method_id" required>
              <SelectTrigger id="extra_method" className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  )
}
