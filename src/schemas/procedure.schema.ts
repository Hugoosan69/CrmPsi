import { z } from "zod"

export const procedureSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do procedimento"),
  description: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
  duration_minutes: z.coerce.number().int().min(5, "Duração mínima de 5 minutos"),
  price: z.coerce.number().min(0, "Preço não pode ser negativo"),
})

export type ProcedureFormInput = z.input<typeof procedureSchema>
