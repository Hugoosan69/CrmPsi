import { z } from "zod"

import { CLINIC_UTC_OFFSET } from "@/utils/datetime"

const optionalUuid = z
  .string()
  .uuid()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null))

/** Mesmo tratamento do agendamento: o offset da clínica fica explícito, não implícito. */
const optionalLocalDateTime = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((value) => {
    if (!value) return null
    const withSeconds = value.length === 16 ? `${value}:00` : value
    return `${withSeconds}${CLINIC_UTC_OFFSET}`
  })

export const campaignSchema = z
  .object({
    name: z.string().trim().min(2, "Dê um nome à campanha").max(120),
    channel: z.enum(["whatsapp", "sms", "email"]),
    subject: z
      .string()
      .trim()
      .max(160)
      .optional()
      .or(z.literal(""))
      .transform((v) => (v ? v : null)),
    body_template: z.string().trim().min(4, "Escreva a mensagem"),
    audience: z.enum(["active", "inactive", "all", "single"]),
    patient_id: optionalUuid,
    scheduled_for: optionalLocalDateTime,
  })
  // O banco tem a mesma checagem, mas repetida aqui para virar mensagem na tela em vez de
  // erro de constraint.
  .refine((v) => v.audience !== "single" || Boolean(v.patient_id), {
    message: "Selecione o paciente que vai receber",
    path: ["patient_id"],
  })
  // E-mail sem assunto chega como "(sem assunto)" na caixa de entrada, o que faz uma
  // campanha parecer spam.
  .refine((v) => v.channel !== "email" || Boolean(v.subject), {
    message: "E-mail precisa de assunto",
    path: ["subject"],
  })

export const automationSchema = z.object({
  type: z.enum(["confirmation", "reminder", "birthday", "post_visit", "general"]),
  enabled: z.coerce.boolean(),
  channel: z.enum(["whatsapp", "sms", "email"]),
  template_id: optionalUuid,
  offset_minutes: z.coerce.number().int().min(-10080).max(10080),
  send_at_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? `${v}:00` : null)),
})

export type CampaignInput = z.infer<typeof campaignSchema>
export type AutomationInput = z.infer<typeof automationSchema>
