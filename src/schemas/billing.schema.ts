import { z } from "zod"

/** Vírgula decimal do teclado brasileiro — "60,00" chega assim do formulário. */
const valorOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => {
    if (!v) return null
    const n = Number(v.replace(/\./g, "").replace(",", "."))
    return Number.isFinite(n) ? n : null
  })
  .refine((v) => v === null || v >= 0, "Informe um valor válido")

/**
 * Tipo de cobrança.
 *
 * `payer` é o campo que manda: os valores e os contatos só são exigidos — e só são
 * gravados — no modo convênio, onde significam alguma coisa.
 */
export const billingTypeSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome").max(120, "Nome muito longo"),
    payer: z.enum(["paciente", "convenio", "ninguem"]),
    amount_per_guide: valorOpcional,
    fallback_amount: valorOpcional,
    contact_name: z.string().trim().max(160).optional().nullable(),
    contact_email: z.string().trim().max(160).optional().nullable(),
    contact_phone: z.string().trim().max(40).optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
  })
  .refine(
    (v) => v.payer !== "convenio" || (v.amount_per_guide !== null && v.amount_per_guide > 0),
    {
      message: "No convênio, informe quanto ele paga por guia",
      path: ["amount_per_guide"],
    }
  )

export type BillingTypeFormInput = z.infer<typeof billingTypeSchema>
