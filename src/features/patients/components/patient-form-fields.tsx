import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Database } from "@/types/supabase"

type Patient = Database["public"]["Tables"]["patients"]["Row"]

/** Uncontrolled fields (defaultValue) so this works with both a create form (empty)
 * and an edit form (pre-filled) submitted via a Server Action's FormData. */
export function PatientFormFields({ patient }: { patient?: Patient | null }) {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 grid gap-1.5">
          <Label htmlFor="full_name">Nome completo</Label>
          <Input id="full_name" name="full_name" required defaultValue={patient?.full_name} />
        </div>
        <div className="col-span-2 grid gap-1.5">
          <Label htmlFor="social_name">Nome social / preferido</Label>
          <Input id="social_name" name="social_name" defaultValue={patient?.social_name ?? ""} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cpf">CPF</Label>
          <Input id="cpf" name="cpf" defaultValue={patient?.cpf ?? ""} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="birth_date">Data de nascimento</Label>
          <Input id="birth_date" name="birth_date" type="date" defaultValue={patient?.birth_date ?? ""} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sex">Sexo</Label>
          <Input id="sex" name="sex" defaultValue={patient?.sex ?? ""} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="mother_name">Nome da mãe</Label>
          <Input id="mother_name" name="mother_name" defaultValue={patient?.mother_name ?? ""} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" name="phone" defaultValue={patient?.phone ?? ""} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input id="whatsapp" name="whatsapp" defaultValue={patient?.whatsapp ?? ""} />
        </div>
        <div className="col-span-2 grid gap-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" defaultValue={patient?.email ?? ""} />
        </div>
        <div className="col-span-2 grid gap-1.5">
          <Label htmlFor="notes">Observações</Label>
          <Textarea id="notes" name="notes" rows={3} defaultValue={patient?.notes ?? ""} />
        </div>
      </div>
    </div>
  )
}
