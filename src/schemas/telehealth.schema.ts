import { z } from "zod"

import { MESSAGE_MAX_LENGTH } from "@/services/telehealth.service"

/** Convite: o nome exibido é o único campo que o operador digita. */
export const createInviteSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, "Informe o nome de quem vai receber o link")
    .max(120, "Nome muito longo"),
  /** Validade em horas; o padrão do serviço vale quando ausente. */
  ttl_hours: z.coerce.number().int().min(1).max(168).optional(),
})

/**
 * Mensagem do chat.
 *
 * O limite é conferido aqui, no CHECK da tabela e no cliente — três vezes de propósito: o
 * cliente é conveniência, o schema é a fronteira do servidor e o CHECK é o que resta se
 * alguém escrever direto no banco. O conteúdo é TEXTO e é gravado como texto; quem
 * renderiza é que precisa escapar.
 */
export const chatMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Mensagem vazia")
    .max(MESSAGE_MAX_LENGTH, `Máximo de ${MESSAGE_MAX_LENGTH} caracteres`),
})

export type CreateInviteInput = z.infer<typeof createInviteSchema>
export type ChatMessageInput = z.infer<typeof chatMessageSchema>
