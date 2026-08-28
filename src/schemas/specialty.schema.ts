import { z } from "zod"

export const specialtySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe o nome da especialidade")
    .max(80, "Nome muito longo"),
  description: z
    .string()
    .trim()
    .max(240, "Descrição muito longa")
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
})

export type SpecialtyInput = z.infer<typeof specialtySchema>
