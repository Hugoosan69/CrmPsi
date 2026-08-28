"use client"

import { useActionState, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import type { Database } from "@/types/supabase"
import type { SpecialtyOption } from "@/types/options"
import { inviteUserAction, type UserActionState } from "../actions/user.actions"

type Role = Pick<Database["public"]["Tables"]["roles"]["Row"], "id" | "name">

const initialState: UserActionState = {}

export function InviteUserDialog({
  roles,
  specialties = [],
}: {
  roles: Role[]
  specialties?: SpecialtyOption[]
}) {
  const [open, setOpen] = useState(false)
  const [accessMode, setAccessMode] = useState<"invite" | "password">("password")
  const [isProfessional, setIsProfessional] = useState(false)
  const [state, formAction, isPending] = useActionState(inviteUserAction, initialState)

  useCloseOnSuccess(state, Boolean(state.success), () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Novo usuário</Button>} />
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="full_name">Nome completo</Label>
              <Input id="full_name" name="full_name" required autoFocus />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" required />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="role_id">Papel</Label>
              <Select name="role_id" required>
                <SelectTrigger id="role_id">
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
            </div>

            <fieldset className="grid gap-2 rounded-lg border border-border p-3">
              <legend className="px-1 text-[0.8rem] font-medium">Como a pessoa entra</legend>
              <input type="hidden" name="access_mode" value={accessMode} />

              <label className="flex items-start gap-2.5 text-sm">
                <input
                  type="radio"
                  className="mt-1"
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

            <fieldset className="grid gap-2 rounded-lg border border-border p-3">
              <legend className="px-1 text-[0.8rem] font-medium">Ficha de profissional</legend>
              <label className="flex items-start gap-2.5 text-sm">
                <input
                  type="checkbox"
                  name="is_professional"
                  className="mt-1"
                  checked={isProfessional}
                  onChange={(event) => setIsProfessional(event.target.checked)}
                />
                <span>
                  Esta pessoa atende pacientes
                  <span className="block text-[0.78rem] text-muted-foreground">
                    Cria a ficha de profissional já vinculada a este login — é o vínculo que
                    dá fila, agenda e horários próprios.
                  </span>
                </span>
              </label>

              {isProfessional && (
                <div className="mt-1 grid gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="professional_register">
                      Registro <span className="text-muted-foreground">(CRM/CRP/CRO)</span>
                    </Label>
                    <Input id="professional_register" name="professional_register" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="specialty_id">Especialidade</Label>
                    <Select name="specialty_id">
                      <SelectTrigger id="specialty_id">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {specialties.map((specialty) => (
                          <SelectItem key={specialty.id} value={specialty.id}>
                            {specialty.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
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
              {isPending ? "Criando..." : "Criar usuário"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
