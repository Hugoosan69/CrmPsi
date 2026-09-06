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

/**
 * Recebimento por convênio.
 *
 * Não é uma variação do pagamento comum — é outro fato. Quem paga é o convênio, no fim do
 * mês, contra um protocolo; o que acontece no balcão é a EMISSÃO DA GUIA, e o paciente sai
 * sem dever nada (ou devendo só a diferença, quando o procedimento custa mais do que o
 * convênio paga).
 *
 * `amount` aqui é o AVULSO — o que o paciente paga por cima. Zero quando a guia cobre tudo,
 * e é por isso que ele não usa `positive()` como o pagamento comum.
 */
export const insurerPaymentSchema = z.object({
  insurer_id: z.string().uuid("Selecione o convênio"),
  guide_number: z
    .string()
    .trim()
    .min(1, "Informe o número da guia")
    .max(60, "Número de guia muito longo"),
  /** Quando marcado, o paciente paga a diferença e `amount` precisa ser maior que zero. */
  has_extra_charge: z
    .union([z.literal("on"), z.literal("true"), z.literal("")])
    .optional()
    .transform((v) => v === "on" || v === "true"),
  amount: z.coerce.number().min(0, "Valor inválido").default(0),
  /** Forma do avulso — só exigida quando há avulso. */
  payment_method_id: z.string().uuid().optional().or(z.literal("")),
  attachment_url: z.string().trim().url("Endereço inválido").optional().or(z.literal("")),
  notes: optionalText,
})

export type PaymentFormInput = z.input<typeof paymentSchema>
