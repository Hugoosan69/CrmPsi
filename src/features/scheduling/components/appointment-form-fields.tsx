import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PatientCombobox } from "@/features/patients/components/patient-combobox"
import type { Database } from "@/types/supabase"
import { toDateTimeLocalValue } from "@/utils/datetime"
import type { ProcedureOption, ProfessionalOption } from "@/types/options"

type Appointment = Database["public"]["Tables"]["appointments"]["Row"]
export function AppointmentFormFields({
  appointment,
  patientDefault,
  professionals,
  procedures,
}: {
  appointment?: Appointment | null
  patientDefault?: { id: string; label: string }
  professionals: ProfessionalOption[]
  procedures: ProcedureOption[]
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label>Paciente</Label>
        <PatientCombobox name="patient_id" defaultValue={patientDefault} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="professional_id">Profissional</Label>
          <Select name="professional_id" defaultValue={appointment?.professional_id ?? undefined} required>
            <SelectTrigger id="professional_id" className="w-full">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {professionals.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="procedure_id">Procedimento</Label>
          <Select name="procedure_id" defaultValue={appointment?.procedure_id ?? undefined}>
            <SelectTrigger id="procedure_id" className="w-full">
              <SelectValue placeholder="Opcional" />
            </SelectTrigger>
            <SelectContent>
              {procedures.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="scheduled_at">Data e horário</Label>
          <Input
            id="scheduled_at"
            name="scheduled_at"
            type="datetime-local"
            required
            defaultValue={appointment ? toDateTimeLocalValue(appointment.scheduled_at) : undefined}
          />
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
            defaultValue={appointment?.duration_minutes ?? 30}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="notes">Observações</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={appointment?.notes ?? ""} />
      </div>
    </div>
  )
}
