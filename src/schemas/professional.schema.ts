import { z } from "zod"

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))

export const professionalSchema = z.object({
  full_name: z.string().trim().min(2, "Informe o nome completo"),
  professional_register: optionalText,
  specialty_id: optionalText,
  phone: optionalText,
  email: z
    .string()
    .trim()
    .email("E-mail inválido")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  color: z.string().trim().default("#0B3D5C"),
})

export type ProfessionalFormInput = z.input<typeof professionalSchema>
