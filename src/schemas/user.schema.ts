import { z } from "zod"

/**
 * Criar usuário tem dois caminhos, e a escolha importa: enquanto o SMTP do projeto não
 * estiver entregando, o convite por e-mail simplesmente não cria acesso nenhum — a pessoa
 * nunca recebe o link e nunca define senha. Definir a senha na hora é o caminho que
 * funciona sem depender de e-mail.
 */
export const createUserSchema = z
  .object({
    full_name: z.string().trim().min(2, "Informe o nome completo"),
    email: z.string().trim().email("E-mail inválido"),
    role_id: z.string().uuid("Selecione um papel"),
    access_mode: z.enum(["invite", "password"]),
    password: z.string().optional(),
    // Marcar aqui cria também a ficha de profissional já vinculada a este login.
    is_professional: z.coerce.boolean().optional().default(false),
    professional_register: z.string().trim().max(40).optional().or(z.literal("")),
    specialty_id: z.string().uuid().optional().or(z.literal("")),
  })
  .refine(
    (v) => v.access_mode !== "password" || (v.password?.length ?? 0) >= 8,
    { message: "A senha precisa ter ao menos 8 caracteres", path: ["password"] }
  )

export type CreateUserInput = z.infer<typeof createUserSchema>

/** Edição feita pela gestão — nome e papel. E-mail não muda aqui: trocá-lo exige mexer em
 *  auth.users e reconfirmar o endereço, que é outro fluxo. */
export const updateUserSchema = z.object({
  full_name: z.string().trim().min(2, "Informe o nome completo"),
  role_id: z.string().uuid("Selecione um papel"),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  // Vazio significa "não mexer". Só quem tem users.manage chega aqui.
  email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
})

/** Ficha de profissional criada para um usuário que já existe — nome e e-mail vêm do
 *  cadastro dele, então só o que é específico da atuação clínica é pedido. */
export const linkProfessionalSchema = z.object({
  professional_register: z.string().trim().max(40).optional().or(z.literal("")),
  specialty_id: z.string().uuid().optional().or(z.literal("")),
  /** Quando preenchido, vincula uma ficha já existente em vez de criar outra. */
  existing_professional_id: z.string().uuid().optional().or(z.literal("")),
})

export type UpdateUserInput = z.infer<typeof updateUserSchema>

// Nome antigo mantido enquanto houver import remanescente.
export const inviteUserSchema = createUserSchema
