import { z } from "zod"

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))

export const patientSchema = z.object({
  full_name: z.string().trim().min(2, "Informe o nome completo"),
  social_name: optionalText,
  cpf: optionalText,
  birth_date: optionalText,
  sex: optionalText,
  phone: optionalText,
  whatsapp: optionalText,
  email: z
    .string()
    .trim()
    .email("E-mail inválido")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  mother_name: optionalText,
  notes: optionalText,
})

export type PatientFormInput = z.input<typeof patientSchema>
export type PatientFormOutput = z.output<typeof patientSchema>
