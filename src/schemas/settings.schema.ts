import { z } from "zod"

/**
 * n8n webhook URLs are operator-supplied and the server fetches them, so this is an SSRF
 * surface. Restricting to http/https keeps `file:`, `gopher:` and friends out; the host
 * itself is deliberately not restricted, because a clinic self-hosting n8n on its own
 * network is the normal case.
 */
const webhookUrl = z
  .string()
  .trim()
  .url("Informe uma URL válida (começando com https://)")
  .refine((value) => /^https?:\/\//i.test(value), {
    message: "A URL precisa usar http:// ou https://",
  })

export const n8nSettingsSchema = z
  .object({
    enabled: z.coerce.boolean(),
    webhook_url: z.string().trim(),
    // Empty means "keep what is stored" — the field renders masked, never pre-filled.
    secret: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : undefined)),
    clear_secret: z.coerce.boolean().optional(),
    channels: z
      .array(z.enum(["whatsapp", "sms", "email"]))
      .min(1, "Selecione ao menos um canal"),
  })
  .refine((v) => !v.enabled || webhookUrl.safeParse(v.webhook_url).success, {
    message: "Informe uma URL de webhook válida para ativar a integração",
    path: ["webhook_url"],
  })

export const brandingSchema = z.object({
  logo_url: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^(https?:\/\/|\/)/i.test(v), {
      message: "Informe uma URL http(s) ou um caminho começando com /",
    }),
})

export type N8nSettingsInput = z.input<typeof n8nSettingsSchema>
