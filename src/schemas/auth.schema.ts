import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().min(1, "Informe o e-mail").email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
})

export type LoginInput = z.infer<typeof loginSchema>

export const passwordResetRequestSchema = z.object({
  email: z.string().min(1, "Informe o e-mail").email("E-mail inválido"),
})

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "A senha precisa ter ao menos 8 caracteres")
      .max(72, "Senha muito longa"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "As senhas não coincidem",
    path: ["confirm"],
  })

export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>
export type NewPasswordInput = z.infer<typeof newPasswordSchema>
