import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import type { InsurerView } from "@/services/billing.service"

export type ProcedureOption = { id: string; name: string; specialtyName: string | null }

/**
 * Os campos de um convênio.
 *
 * Não há valor por guia (migration 032): o que o convênio paga só se sabe quando ele paga.
 * O que se cadastra aqui são as duas regras que precisam valer no balcão, na hora — quantas
 * guias o paciente pode usar no mês, e que procedimentos este convênio cobre.
 */
export function InsurerFormFields({
  insurer,
  procedures,
  selectedProcedureIds = [],
}: {
  insurer?: InsurerView
  procedures: ProcedureOption[]
  selectedProcedureIds?: string[]
}) {
  const marcados = new Set(selectedProcedureIds)

  return (
    <div className="grid gap-4 py-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
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
          <Label htmlFor="max_guides_per_patient_month">Guias por paciente/mês</Label>
          <Input
            id="max_guides_per_patient_month"
            name="max_guides_per_patient_month"
            type="number"
            min="1"
            step="1"
            defaultValue={insurer?.max_guides_per_patient_month ?? ""}
            placeholder="sem limite"
          />
        </div>
      </div>
      <p className="text-[0.75rem] text-muted-foreground">
        Atingido o limite, o sistema recusa emitir mais uma guia no mês e o atendimento
        passa a ser cobrado como particular, pelo preço do procedimento. Deixe vazio se não
        houver teto combinado.
      </p>

      <div className="grid gap-2">
        <Label>
          Procedimentos cobertos <span className="text-muted-foreground">(opcional)</span>
        </Label>
        {procedures.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-3 text-[0.78rem] text-muted-foreground">
            Nenhum procedimento cadastrado ainda.
          </p>
        ) : (
          <div className="grid max-h-52 gap-1 overflow-y-auto rounded-lg border border-border p-2">
            {procedures.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/60"
              >
                <Checkbox
                  name="procedure_ids"
                  value={p.id}
                  defaultChecked={marcados.has(p.id)}
                />
                <span className="text-[0.85rem]">
                  {p.name}
                  {p.specialtyName && (
                    <span className="text-muted-foreground"> · {p.specialtyName}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        )}
        <p className="text-[0.75rem] text-muted-foreground">
          Marque só o que este convênio cobre — no registro do pagamento desses
          procedimentos, ele será o único oferecido. Sem nada marcado, o convênio aparece
          para qualquer procedimento.
        </p>
      </div>

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
