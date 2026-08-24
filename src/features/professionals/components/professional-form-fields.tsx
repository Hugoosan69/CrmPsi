import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Database } from "@/types/supabase"

type Professional = Database["public"]["Tables"]["professionals"]["Row"]
type Specialty = Pick<Database["public"]["Tables"]["specialties"]["Row"], "id" | "name">

export function ProfessionalFormFields({
  professional,
  specialties,
}: {
  professional?: Professional | null
  specialties: Specialty[]
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2 grid gap-1.5">
        <Label htmlFor="full_name">Nome completo</Label>
        <Input id="full_name" name="full_name" required defaultValue={professional?.full_name} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="professional_register">Registro profissional</Label>
        <Input
          id="professional_register"
          name="professional_register"
          placeholder="CRM, CRP, CRO..."
          defaultValue={professional?.professional_register ?? ""}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="specialty_id">Especialidade</Label>
        <Select name="specialty_id" defaultValue={professional?.specialty_id ?? undefined}>
          <SelectTrigger id="specialty_id" className="w-full">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {specialties.map((specialty) => (
              <SelectItem key={specialty.id} value={specialty.id}>
                {specialty.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="phone">Telefone</Label>
        <Input id="phone" name="phone" defaultValue={professional?.phone ?? ""} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" defaultValue={professional?.email ?? ""} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="color">Cor na agenda</Label>
        <Input
          id="color"
          name="color"
          type="color"
          className="h-9 w-16 p-1"
          defaultValue={professional?.color ?? "#0B3D5C"}
        />
      </div>
    </div>
  )
}
