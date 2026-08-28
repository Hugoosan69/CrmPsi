"use client"

import { useActionState, useState } from "react"
import { Pencil } from "lucide-react"

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
import { useCloseOnSuccess } from "@/hooks/use-close-on-success"
import type { Database } from "@/types/supabase"
import type { ClinicMember } from "@/services/users.service"
import { updateUserAction, type UserActionState } from "../actions/user.actions"

type Role = Pick<Database["public"]["Tables"]["roles"]["Row"], "id" | "name">

const initialState: UserActionState = {}

/**
 * Edição de um membro pela gestão.
 *
 * Antes só existia a troca de papel direto na tabela; nome e telefone só davam para alterar
 * em Meu perfil, pelo próprio dono. Isso deixava a gestão sem como corrigir um cadastro
 * errado — um nome digitado errado no convite só saía se a pessoa conseguisse entrar, que é
 * exatamente o que não acontece quando o cadastro está errado.
 */
export function EditUserDialog({ member, roles }: { member: ClinicMember; roles: Role[] }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(
    updateUserAction.bind(null, member.membershipId),
    initialState
  )

  useCloseOnSuccess(state, Boolean(state.success), () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" aria-label={`Editar ${member.fullName}`}>
            <Pencil className="size-3.5" />
            <span className="sr-only sm:not-sr-only sm:ml-1.5">Editar</span>
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor={`edit-name-${member.membershipId}`}>Nome completo</Label>
              <Input
                id={`edit-name-${member.membershipId}`}
                name="full_name"
                defaultValue={member.fullName}
                required
                autoFocus
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={`edit-phone-${member.membershipId}`}>
                Telefone <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <Input id={`edit-phone-${member.membershipId}`} name="phone" />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={`edit-role-${member.membershipId}`}>Papel</Label>
              <Select name="role_id" defaultValue={member.roleId} required>
                <SelectTrigger id={`edit-role-${member.membershipId}`}>
                  <SelectValue />
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

            <div className="grid gap-1.5">
              <Label htmlFor={`edit-email-${member.membershipId}`}>E-mail de acesso</Label>
              <Input
                id={`edit-email-${member.membershipId}`}
                name="email"
                type="email"
                defaultValue={member.email}
              />
              <p className="text-[0.75rem] text-muted-foreground">
                O endereço novo já entra confirmado — a pessoa passa a entrar com ele
                imediatamente. Não é enviado e-mail de confirmação, justamente para o acesso
                não depender do SMTP estar entregando.
              </p>
            </div>

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
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
