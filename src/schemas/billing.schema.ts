import { z } from "zod"

/** Vírgula decimal do teclado brasileiro — "60,00" chega assim do formulário. */
const valor = z
  .string()
  .trim()
  .transform((v) => {
    const n = Number(v.replace(/\./g, "").replace(",", "."))
    return Number.isFinite(n) ? n : NaN
  })
  .refine((v) => !Number.isNaN(v) && v >= 0, "Informe um valor válido")

/**
 * Convênio.
 *
 * `amount_per_guide` é obrigatório: um convênio sem valor por guia não consegue gerar
 * protocolo, e descobrir isso no fim do mês, com os atendimentos já feitos, é tarde.
 */
export const insurerSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(120, "Nome muito longo"),
  amount_per_guide: valor,
  contact_name: z.string().trim().max(160).optional().nullable(),
  contact_email: z.string().trim().max(160).optional().nullable(),
  contact_phone: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
})

export type InsurerFormInput = z.infer<typeof insurerSchema>
