"use client"

import { useState } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BillingType } from "@/services/billing.service"

/**
 * Os campos de um tipo de cobrança.
 *
 * O bloco do convênio só aparece quando `payer = convenio` — os valores e os contatos não
 * significam nada nos outros modos, e um formulário que mostra campo inaplicável convida a
 * preenchê-lo.
 */
export function BillingTypeFormFields({ billingType }: { billingType?: BillingType }) {
  const [payer, setPayer] = useState<string>(billingType?.payer ?? "paciente")
  const ehConvenio = payer === "convenio"

  return (
    <div className="grid gap-4 py-4">
      <div className="grid gap-1.5">
        <Label htmlFor="name">Nome</Label>
        <Input
          id="name"
          name="name"
          defaultValue={billingType?.name ?? ""}
          placeholder="CABEN"
          required
          autoFocus
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="payer">Quem paga</Label>
        <Select name="payer" value={payer} onValueChange={(v) => setPayer(v ?? "paciente")} required>
          <SelectTrigger id="payer" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="paciente">O paciente — particular</SelectItem>
            <SelectItem value="convenio">Um convênio — pago em lote, contra protocolo</SelectItem>
            <SelectItem value="ninguem">Ninguém — cortesia</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[0.75rem] text-muted-foreground">
          É isto que decide o resto: quem recebe a cobrança e quando o dinheiro entra.
        </p>
      </div>

      {ehConvenio && (
        <div className="grid gap-4 rounded-xl border border-border p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="amount_per_guide">Valor por guia (R$)</Label>
              <Input
                id="amount_per_guide"
                name="amount_per_guide"
                inputMode="decimal"
                defaultValue={billingType?.amount_per_guide ?? ""}
                placeholder="60,00"
              />
              <p className="text-[0.72rem] text-muted-foreground">
                O que o convênio paga por atendimento.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="fallback_amount">Valor sem guia (R$)</Label>
              <Input
                id="fallback_amount"
                name="fallback_amount"
                inputMode="decimal"
                defaultValue={billingType?.fallback_amount ?? ""}
                placeholder="100,00"
              />
              <p className="text-[0.72rem] text-muted-foreground">
                O que o <strong>paciente</strong> paga quando o saldo de guias acabou. É o
                que permite atender sem guia sem criar um segundo cadastro.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="contact_name">Contato</Label>
              <Input
                id="contact_name"
                name="contact_name"
                defaultValue={billingType?.contact_name ?? ""}
                placeholder="Quem recebe o protocolo"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="contact_phone">Telefone</Label>
              <Input
                id="contact_phone"
                name="contact_phone"
                defaultValue={billingType?.contact_phone ?? ""}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="contact_email">E-mail</Label>
            <Input
              id="contact_email"
              name="contact_email"
              type="email"
              defaultValue={billingType?.contact_email ?? ""}
            />
          </div>
        </div>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="notes">
          Observações <span className="text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={billingType?.notes ?? ""} />
      </div>
    </div>
  )
}
