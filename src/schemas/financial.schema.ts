import { z } from "zod"

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))

export const transactionSchema = z.object({
  type: z.enum(["receita", "despesa"]),
  patient_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  category: optionalText,
  description: optionalText,
  amount: z.coerce.number().positive("Informe um valor maior que zero"),
  due_date: optionalText,
})

export type TransactionFormInput = z.input<typeof transactionSchema>

export const paymentSchema = z.object({
  payment_method_id: z.string().uuid("Selecione a forma de pagamento"),
  amount: z.coerce.number().positive("Informe um valor maior que zero"),
  notes: optionalText,
})

export type PaymentFormInput = z.input<typeof paymentSchema>
