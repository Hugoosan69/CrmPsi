import { z } from "zod"

import { normalizeServerUrl, normalizeWebhookPath } from "@/config/n8n"

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

/** Servidor n8n: host com esquema e porta, sem caminho. */
const serverUrl = z
  .string()
  .trim()
  .refine((v) => /^https?:\/\/[^/\s]+$/i.test(v.replace(/\/+$/, "")), {
    message: "Informe só o servidor, ex.: http://64.181.189.174:5678 (sem /webhook)",
  })

export const n8nSettingsSchema = z
  .object({
    enabled: z.coerce.boolean(),
    base_url: z.string().trim().default("").transform(normalizeServerUrl),
    // Aceita desde o nome puro até a URL inteira copiada do editor do n8n — colar a URL
    // que ele exibe é o gesto natural, e rejeitar isso só produz configuração errada.
    path: z.string().trim().default("").transform(normalizeWebhookPath),
    webhook_url: z.string().trim().default(""),
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
  // Ativar exige um destino utilizável: servidor + caminho (formato novo) OU a URL
  // completa gravada pelo formato antigo. Sem isso a integração ficaria "ligada"
  // apontando para lugar nenhum, e as mensagens falhariam em silêncio.
  .refine(
    (v) =>
      !v.enabled ||
      (serverUrl.safeParse(v.base_url).success && v.path.length > 0) ||
      webhookUrl.safeParse(v.webhook_url).success,
    {
      message: "Informe o servidor n8n e o caminho do webhook para ativar a integração",
      path: ["base_url"],
    }
  )

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
