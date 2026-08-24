import { z } from "zod"

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))

export const messageTemplateSchema = z.object({
  type: z.enum(["confirmation", "reminder", "birthday", "post_visit", "general"]),
  channel: z.enum(["whatsapp", "sms", "email"]),
  subject: optionalText,
  body_template: z.string().trim().min(1, "Informe o conteúdo do modelo"),
})

export type MessageTemplateFormInput = z.input<typeof messageTemplateSchema>

export const sendMessageSchema = z.object({
  channel: z.enum(["whatsapp", "sms", "email"]),
  type: z.enum(["confirmation", "reminder", "birthday", "post_visit", "general"]),
  subject: optionalText,
  body: z.string().trim().min(1, "A mensagem não pode ficar vazia"),
})

export type SendMessageFormInput = z.input<typeof sendMessageSchema>
