import { z } from "zod"

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))

export const sessionPackageSchema = z.object({
  specialty_id: z.string().uuid("Selecione a especialidade"),
  name: z.string().trim().min(1, "Informe o nome do pacote"),
  total_sessions: z.coerce.number().int().min(1, "Informe ao menos 1 sessão"),
  total_price: z.coerce.number().min(0, "Informe um valor válido"),
  /** Como o pacote entra no financeiro — ver database/migrations/019. */
  billing_mode: z.enum(["unico", "por_sessao"]).default("unico"),
})

export type SessionPackageFormInput = z.input<typeof sessionPackageSchema>

export const sellPackageSchema = z.object({
  patient_id: z.string().uuid("Selecione um paciente"),
  session_package_id: z.string().uuid("Selecione um pacote"),
  payment_method_id: z.string().uuid("Selecione a forma de pagamento"),
  notes: optionalText,
})

export type SellPackageFormInput = z.input<typeof sellPackageSchema>

export const retroactiveLinkSchema = z.object({
  transaction_id: z.string().uuid(),
  session_package_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  patient_package_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  session_number: z.coerce.number().int().min(1, "Informe a posição da sessão"),
})

export type RetroactiveLinkFormInput = z.input<typeof retroactiveLinkSchema>
