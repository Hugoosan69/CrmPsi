import { z } from "zod"

export const inviteUserSchema = z.object({
  full_name: z.string().trim().min(2, "Informe o nome completo"),
  email: z.string().trim().email("E-mail inválido"),
  role_id: z.string().uuid("Selecione um papel"),
})

export type InviteUserInput = z.infer<typeof inviteUserSchema>
