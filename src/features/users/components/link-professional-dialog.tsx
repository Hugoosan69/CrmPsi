"use client"

import { useActionState, useState } from "react"
import { Stethoscope } from "lucide-react"

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
import { useCloseOnSuccess } from "@/hooks/use-close-on-success"
import type { SpecialtyOption } from "@/types/options"
import type { ClinicMember } from "@/services/users.service"
import { linkProfessionalAction, type UserActionState } from "../actions/user.actions"

const initialState: UserActionState = {}

/**
 * Dá ficha de profissional a alguém que já é usuário.
 *
 * Existe porque os dois cadastros nasceram separados: dava para ter um usuário com papel
 * "profissional" sem ficha em `professionals`, e portanto sem fila, agenda nem horários. Para
 * quem já foi cadastrado antes de ter login, a ficha órfã pode ser reaproveitada em vez de
 * duplicada — daí o seletor.
 */
export function LinkProfessionalDialog({
  member,
  specialties,
  unlinked,
}: {
  member: ClinicMember
  specialties: SpecialtyOption[]
  unlinked: { id: string; full_name: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [existingId, setExistingId] = useState("")
  const [state, formAction, isPending] = useActionState(
    linkProfessionalAction.bind(null, member.userId),
    initialState
  )

  useCloseOnSuccess(state, Boolean(state.success), () => setOpen(false))

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Tornar ${member.fullName} um profissional`}
      >
        <Stethoscope className="size-3.5" />
        <span className="sr-only sm:not-sr-only sm:ml-1.5">Tornar profissional</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <form action={formAction}>
            <DialogHeader>
              <DialogTitle>Ficha de profissional</DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <p className="text-[0.82rem] text-muted-foreground">
                Cria a ficha de <strong>{member.fullName}</strong> já vinculada ao login dele.
                É esse vínculo que dá fila, agenda e horários próprios.
              </p>

              {unlinked.length > 0 && (
                <div className="grid gap-1.5">
                  <Label htmlFor={`existing-${member.membershipId}`}>
                    Já existe uma ficha para esta pessoa?
                  </Label>
                  <Select
                    name="existing_professional_id"
                    value={existingId}
                    onValueChange={(v) => setExistingId(v ?? "")}
                  >
                    <SelectTrigger id={`existing-${member.membershipId}`}>
                      <SelectValue placeholder="Não — criar uma nova" />
                    </SelectTrigger>
                    <SelectContent>
                      {unlinked.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[0.75rem] text-muted-foreground">
                    Fichas cadastradas antes de a pessoa ter acesso ao sistema. Selecionar uma
                    aproveita o histórico dela em vez de criar um cadastro duplicado.
                  </p>
                </div>
              )}

              {!existingId && (
                <>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`reg-${member.membershipId}`}>
                      Registro <span className="text-muted-foreground">(CRM/CRP/CRO)</span>
                    </Label>
                    <Input id={`reg-${member.membershipId}`} name="professional_register" />
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor={`spec-${member.membershipId}`}>Especialidade</Label>
                    <Select name="specialty_id">
                      <SelectTrigger id={`spec-${member.membershipId}`}>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {specialties.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

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
                {isPending ? "Salvando..." : existingId ? "Vincular ficha" : "Criar ficha"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
