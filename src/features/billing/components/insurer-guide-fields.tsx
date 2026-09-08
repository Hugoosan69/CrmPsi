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

export type InsurerOption = {
  id: string
  name: string
  max_guides_per_patient_month: number | null
  /** Procedimentos cobertos. Vazio = cobre qualquer um. */
  procedureIds: string[]
}

type PaymentMethod = { id: string; name: string }

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

/**
 * Escolhe os convênios que este atendimento pode usar.
 *
 * A regra vem da migration 032: se ALGUM convênio declara cobrir este procedimento, só
 * esses aparecem — é como "o CABEN é de psicologia" fica dito sem estar escrito no código.
 * Se nenhum declara, todos aparecem: não vincular nada é o estado de quem ainda não
 * configurou, e não deve fechar porta.
 */
function convêniosDoProcedimento(
  insurers: InsurerOption[],
  procedureId: string | null
): InsurerOption[] {
  if (!procedureId) return insurers
  const vinculados = insurers.filter((i) => i.procedureIds.includes(procedureId))
  return vinculados.length > 0 ? vinculados : insurers.filter((i) => i.procedureIds.length === 0)
}

/**
 * Os campos que descem quando a forma de pagamento é "Convênio".
 *
 * Não há mais a conta "procedimento − valor da guia = sobra". Ela existia porque o convênio
 * declarava quanto pagava, e isso saiu do cadastro (migration 032): o valor só se sabe no
 * acerto. Com guia, o paciente não deve nada — quem deve é o convênio. Sem guia disponível,
 * o atendimento é cobrado pelo preço cheio do procedimento, pelo fluxo normal de pagamento.
 *
 * O avulso continua existindo para o caso de uma cobrança combinada por fora no mesmo
 * atendimento, mas agora é um valor informado, não um resultado calculado.
 */
export function InsurerGuideFields({
  insurers,
  paymentMethods,
  procedureAmount,
  procedureId = null,
}: {
  insurers: InsurerOption[]
  paymentMethods: PaymentMethod[]
  /** O valor que a cobrança tem hoje — o preço do procedimento. */
  procedureAmount: number
  /** O procedimento deste atendimento, que decide quais convênios aparecem. */
  procedureId?: string | null
}) {
  const disponiveis = convêniosDoProcedimento(insurers, procedureId)
  const [insurerId, setInsurerId] = useState<string>(disponiveis[0]?.id ?? "")
  const [temAvulso, setTemAvulso] = useState(false)

  const convenio = disponiveis.find((i) => i.id === insurerId)

  if (insurers.length === 0) {
    return (
      <p className="rounded-md border border-status-warning/40 bg-status-warning/[0.06] px-3 py-2 text-[0.8rem]">
        Nenhum convênio cadastrado. Cadastre em Gestão › Pacotes e convênios antes de
        registrar uma guia.
      </p>
    )
  }

  if (disponiveis.length === 0) {
    return (
      <p className="rounded-md border border-status-warning/40 bg-status-warning/[0.06] px-3 py-2 text-[0.8rem]">
        Nenhum convênio cobre este procedimento. Vincule o procedimento ao convênio em
        Gestão › Pacotes e convênios, ou cobre como particular.
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
            {disponiveis.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {convenio?.max_guides_per_patient_month != null && (
          // O número exato de guias já usadas sai na mensagem de erro, contado no servidor
          // no instante de gravar. Aqui só o teto: buscar a contagem a cada abertura do
          // modal mostraria um saldo que outra pessoa no balcão pode invalidar no meio.
          <p className="text-[0.72rem] text-muted-foreground">
            Limite de {convenio.max_guides_per_patient_month} guia(s) por paciente a cada
            mês. Atingido o limite, o atendimento é cobrado como particular.
          </p>
        )}
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

      <div className="grid gap-1 rounded-lg bg-muted/50 p-3 text-[0.8rem]">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Valor do atendimento</span>
          <span className="tabular-nums">{formatCurrency(procedureAmount)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-1 font-medium">
          <span>O paciente paga</span>
          <span className="tabular-nums text-status-success">
            {temAvulso ? "valor informado abaixo" : formatCurrency(0)}
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
          <span className="text-[0.85rem] font-medium">Cobrar um valor do paciente também</span>
          <span className="text-[0.75rem] text-muted-foreground">
            Sem isto, o atendimento fica em R$ 0,00 para o paciente — só o convênio deve.
          </span>
        </span>
      </label>

      {temAvulso && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="amount">Valor a cobrar (R$)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="extra_method">Forma de pagamento</Label>
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
