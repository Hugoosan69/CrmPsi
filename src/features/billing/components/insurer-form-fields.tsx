import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Insurer } from "@/services/billing.service"

/** Os campos de um convênio. O valor por guia é o que ele paga por atendimento. */
export function InsurerFormFields({ insurer }: { insurer?: Insurer }) {
  return (
    <div className="grid gap-4 py-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <div className="grid gap-1.5">
          <Label htmlFor="name">Nome do convênio</Label>
          <Input
            id="name"
            name="name"
            defaultValue={insurer?.name ?? ""}
            placeholder="CABEN"
            required
            autoFocus
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="amount_per_guide">Valor por guia (R$)</Label>
          <Input
            id="amount_per_guide"
            name="amount_per_guide"
            inputMode="decimal"
            defaultValue={insurer?.amount_per_guide ?? ""}
            placeholder="60,00"
            required
          />
        </div>
      </div>
      <p className="text-[0.75rem] text-muted-foreground">
        É o que o convênio paga por atendimento. A diferença, quando houver, é cobrada do
        paciente como avulso no próprio agendamento — são duas cobranças, não uma escolha
        entre elas.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="contact_name">Contato</Label>
          <Input
            id="contact_name"
            name="contact_name"
            defaultValue={insurer?.contact_name ?? ""}
            placeholder="Quem recebe o protocolo"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="contact_phone">Telefone</Label>
          <Input
            id="contact_phone"
            name="contact_phone"
            defaultValue={insurer?.contact_phone ?? ""}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="contact_email">E-mail</Label>
        <Input
          id="contact_email"
          name="contact_email"
          type="email"
          defaultValue={insurer?.contact_email ?? ""}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="notes">
          Observações <span className="text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={insurer?.notes ?? ""} />
      </div>
    </div>
  )
}
