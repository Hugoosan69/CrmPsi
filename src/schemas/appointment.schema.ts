import { z } from "zod"

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
    return `${withSeconds}-03:00`
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
  scheduled_at: localDateTimeToIso,
  duration_minutes: z.coerce.number().int().min(5, "Duração mínima de 5 minutos"),
  notes: optionalText,
})

export type AppointmentFormInput = z.input<typeof appointmentSchema>
