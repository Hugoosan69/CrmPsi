import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { SessionPackageView } from "@/services/packages.service"

type SpecialtyOption = { id: string; name: string }

export function PackageFormFields({
  sessionPackage,
  specialties,
}: {
  sessionPackage?: SessionPackageView | null
  specialties: SpecialtyOption[]
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2 grid gap-1.5">
        <Label htmlFor="name">Nome do pacote</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="Pacote Psicologia Adulto — 4 sessões"
          defaultValue={sessionPackage?.name}
        />
      </div>
      <div className="col-span-2 grid gap-1.5">
        <Label htmlFor="specialty_id">Especialidade</Label>
        <Select name="specialty_id" defaultValue={sessionPackage?.specialty_id ?? undefined} required>
          <SelectTrigger id="specialty_id" className="w-full">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {specialties.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="total_sessions">Número de sessões</Label>
        <Input
          id="total_sessions"
          name="total_sessions"
          type="number"
          min={1}
          required
          defaultValue={sessionPackage?.total_sessions ?? 4}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="total_price">Valor total (R$)</Label>
        <Input
          id="total_price"
          name="total_price"
          type="number"
          min={0}
          step="0.01"
          required
          defaultValue={sessionPackage?.total_price ?? 0}
        />
      </div>
      <div className="col-span-2 grid gap-1.5">
        <Label htmlFor="billing_mode">Como entra no financeiro</Label>
        <Select
          name="billing_mode"
          defaultValue={sessionPackage?.billing_mode ?? "unico"}
          required
        >
          <SelectTrigger id="billing_mode" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unico">Valor total na venda (sessões a R$ 0,00)</SelectItem>
            <SelectItem value="por_sessao">Valor dividido por sessão realizada</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          No primeiro modo o pacote é contabilizado uma vez, na venda, e as sessões seguintes
          aparecem a R$ 0,00. No segundo, cada sessão carrega a sua parte do valor.
        </p>
      </div>
      <div className="col-span-2 grid gap-1.5">
        <Label htmlFor="period">Período para usar as sessões</Label>
        <Select name="period" defaultValue={sessionPackage?.period ?? "mensal"} required>
          <SelectTrigger id="period" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mensal">Mensal — do dia 1 ao fim do mês</SelectItem>
            <SelectItem value="quinzenal">Quinzenal — dia 1 ao 15, ou 16 ao fim do mês</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          A quinzena é a do calendário, não 15 dias a partir da venda: um pacote vendido no
          dia 20 vale até o fim do mês. O período fica registrado na venda e aparece na ficha
          do paciente — sessão que sobra depois do fim continua podendo ser usada, e aparece
          na varredura de anomalias.
        </p>
      </div>
    </div>
  )
}
