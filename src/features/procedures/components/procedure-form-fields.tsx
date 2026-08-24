import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Database } from "@/types/supabase"

type Procedure = Database["public"]["Tables"]["procedures"]["Row"]

export function ProcedureFormFields({ procedure }: { procedure?: Procedure | null }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2 grid gap-1.5">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" required defaultValue={procedure?.name} />
      </div>
      <div className="col-span-2 grid gap-1.5">
        <Label htmlFor="description">Descrição</Label>
        <Textarea id="description" name="description" rows={2} defaultValue={procedure?.description ?? ""} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="duration_minutes">Duração (min)</Label>
        <Input
          id="duration_minutes"
          name="duration_minutes"
          type="number"
          min={5}
          step={5}
          required
          defaultValue={procedure?.duration_minutes ?? 30}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="price">Preço (R$)</Label>
        <Input
          id="price"
          name="price"
          type="number"
          min={0}
          step="0.01"
          required
          defaultValue={procedure?.price ?? 0}
        />
      </div>
    </div>
  )
}
