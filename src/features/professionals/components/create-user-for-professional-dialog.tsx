"use client"

import { useActionState, useState } from "react"
import { KeyRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PasswordField } from "@/components/ui/password-field"
import { useCloseOnSuccess } from "@/hooks/use-close-on-success"
import type { RoleOption } from "@/types/options"
import {
  createUserForProfessionalAction,
  type ProfessionalActionState,
} from "../actions/professional.actions"

const initialState: ProfessionalActionState = {}

/**
 * Dá acesso ao sistema a quem já tem ficha de profissional.
 *
 * O caminho oposto já existia em Gestão › Usuários: criar o usuário e a ficha de uma vez.
 * Faltava este, que é o mais frequente na clínica — o profissional é cadastrado para poder
 * ser agendado no mesmo dia, e o login vem depois, quando ele precisa abrir prontuário.
 * Antes era preciso sair daqui, criar um usuário do zero em outra tela e voltar para
 * vincular, com o risco de terminar com dois cadastros da mesma pessoa.
 *
 * O nome não é pedido: vem da ficha. Digitá-lo de novo abriria espaço para o login e o
 * cadastro clínico divergirem sobre quem é a mesma pessoa.
 */
export function CreateUserForProfessionalDialog({
  professional,
  roles,
}: {
  professional: { id: string; full_name: string; email: string | null }
  roles: RoleOption[]
}) {
  const [open, setOpen] = useState(false)
  const [accessMode, setAccessMode] = useState<"invite" | "password">("password")
  const [state, formAction, isPending] = useActionState(
    createUserForProfessionalAction.bind(null, professional.id),
    initialState
  )

  useCloseOnSuccess(state, Boolean(state.success), () => setOpen(false))

  const campo = (nome: string) => `${nome}-${professional.id}`

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Criar acesso ao sistema para ${professional.full_name}`}
      >
        <KeyRound className="size-3.5" />
        <span className="sr-only sm:not-sr-only sm:ml-1.5">Criar acesso</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <form action={formAction}>
            <DialogHeader>
              <DialogTitle>Acesso ao sistema</DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <p className="text-[0.82rem] text-muted-foreground">
                Cria o login de <strong>{professional.full_name}</strong> já vinculado à ficha
                que existe. A ficha é reaproveitada — é ela que carrega agenda, fila, horários
                e histórico de atendimento.
              </p>

              <div className="grid gap-1.5">
                <Label htmlFor={campo("email")}>E-mail</Label>
                <Input
                  id={campo("email")}
                  name="email"
                  type="email"
                  // Prenchido com o e-mail da ficha quando há um: é o endereço que a clínica
                  // já usa para falar com essa pessoa.
                  defaultValue={professional.email ?? ""}
                  required
                  autoFocus
                />
                <p className="text-[0.75rem] text-muted-foreground">
                  Será a credencial de acesso. Se for diferente do que está na ficha, a ficha
                  passa a usar este.
                </p>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor={campo("role")}>Papel</Label>
                <Select name="role_id" required>
                  <SelectTrigger id={campo("role")}>
                    <SelectValue placeholder="Selecione um papel" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[0.75rem] text-muted-foreground">
                  Quem atende paciente normalmente entra como Profissional.
                </p>
              </div>

              <fieldset className="grid gap-2 rounded-lg border border-border p-3">
                <legend className="px-1 text-[0.8rem] font-medium">Como a pessoa entra</legend>
                <input type="hidden" name="access_mode" value={accessMode} />

                <label className="flex items-start gap-2.5 text-sm">
                  <input
                    type="radio"
                    className="mt-1"
                    name={campo("modo")}
                    checked={accessMode === "password"}
                    onChange={() => setAccessMode("password")}
                  />
                  <span>
                    Definir uma senha agora
                    <span className="block text-[0.78rem] text-muted-foreground">
                      Acesso liberado na hora. Não depende de e-mail.
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-2.5 text-sm">
                  <input
                    type="radio"
                    className="mt-1"
                    name={campo("modo")}
                    checked={accessMode === "invite"}
                    onChange={() => setAccessMode("invite")}
                  />
                  <span>
                    Enviar convite por e-mail
                    <span className="block text-[0.78rem] text-muted-foreground">
                      A pessoa define a própria senha pelo link. Depende do SMTP do projeto
                      estar entregando.
                    </span>
                  </span>
                </label>

                {accessMode === "password" && (
                  <PasswordField
                    name="password"
                    label="Senha inicial"
                    hint="Ao menos 8 caracteres. Peça para trocar no primeiro acesso."
                    minLength={8}
                    required
                    className="mt-1"
                  />
                )}
              </fieldset>

              {state.error && (
                <p
                  className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {state.error}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Criando..." : "Criar acesso"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
