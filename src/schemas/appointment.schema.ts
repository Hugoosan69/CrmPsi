import { z } from "zod"

import { CLINIC_UTC_OFFSET } from "@/utils/datetime"

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))

/**
 * `<input type="datetime-local">` submits a naive "YYYY-MM-DDTHH:mm" string with no
 * timezone. Brazil has had a single, DST-free offset (-03:00) since 2019, so we treat
 * every clinic timestamp as America/Sao_Paulo wall-clock time and make that explicit
 * before it reaches Postgres — instead of leaving the conversion to whatever timezone
 * the DB session happens to default to.
 */
const localDateTimeToIso = z
  .string()
  .min(1, "Informe data e horário")
  .transform((value) => {
    const withSeconds = value.length === 16 ? `${value}:00` : value
    return `${withSeconds}${CLINIC_UTC_OFFSET}`
  })

export const appointmentSchema = z.object({
  patient_id: z.string().uuid("Selecione um paciente"),
  professional_id: z.string().uuid("Selecione um profissional"),
  procedure_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  room_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  // Não é coluna de `appointments` — é o id do saldo de pacote (patient_packages) a
  // reservar. A Server Action extrai e usa via reservePackageSession antes de repassar o
  // resto ao insert/update de appointments.
  patient_package_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  scheduled_at: localDateTimeToIso,
  duration_minutes: z.coerce.number().int().min(5, "Duração mínima de 5 minutos"),
  // Só as duas situações que se escolhe ao marcar (ver appointment-form-fields). Confirmar,
  // concluir e cancelar são desfechos e têm ações próprias — aceitar qualquer valor do enum
  // aqui deixaria o formulário concluir um atendimento que nunca aconteceu.
  status: z
    .enum(["scheduled", "triagem"])
    .optional()
    .transform((v) => v ?? "scheduled"),
  notes: optionalText,
})

export type AppointmentFormInput = z.input<typeof appointmentSchema>
