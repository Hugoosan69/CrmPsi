"use client"

import { KeyRound, Pencil, Power, Stethoscope } from "lucide-react"

import { RowActions, type RowAction } from "@/components/shared/row-actions"
import { ToggleActiveButton } from "@/components/shared/toggle-active-button"
import type { ClinicMember } from "@/services/users.service"
import type { Database } from "@/types/supabase"
import { setMembershipActiveAction } from "../actions/user.actions"
import { EditUserDialog } from "./edit-user-dialog"
import { LinkProfessionalDialog } from "./link-professional-dialog"
import { SendResetButton } from "./send-reset-button"

type Role = Pick<Database["public"]["Tables"]["roles"]["Row"], "id" | "name">
type UnlinkedProfessional = { id: string; full_name: string }

/**
 * Ações da linha de um membro da clínica. Componente de cliente próprio porque `RowActions`
 * recebe funções de renderização, e função não atravessa a fronteira servidor→cliente.
 */
export function UserRowActions({
  member,
  roles,
  specialties,
  unlinkedProfessionals,
  alreadyLinked,
}: {
  member: ClinicMember
  roles: Role[]
  specialties: { id: string; name: string }[]
  unlinkedProfessionals: UnlinkedProfessional[]
  /** Já tem ficha de profissional — não faz sentido oferecer criar outra. */
  alreadyLinked: boolean
}) {
  const actions: RowAction[] = [
    {
      key: "edit",
      label: "Editar",
      icon: Pencil,
      render: (control) => <EditUserDialog member={member} roles={roles} {...control} />,
    },
  ]

  if (member.active && !alreadyLinked) {
    actions.push({
      key: "link",
      label: "Tornar profissional",
      icon: Stethoscope,
      render: (control) => (
        <LinkProfessionalDialog
          member={member}
          specialties={specialties}
          unlinked={unlinkedProfessionals}
          {...control}
        />
      ),
    })
  }

  // Só para quem ainda consegue entrar — um link de recuperação é inútil para uma conta
  // inativa, que a camada de sessão recusa de qualquer forma.
  if (member.active) {
    actions.push({
      key: "reset",
      label: "Redefinir senha",
      icon: KeyRound,
      render: (control) => (
        <SendResetButton
          membershipId={member.membershipId}
          memberName={member.fullName}
          memberEmail={member.email}
          {...control}
        />
      ),
    })
  }

  actions.push({
    key: "toggle",
    label: member.active ? "Inativar" : "Ativar",
    icon: Power,
    danger: member.active,
    render: (control) => (
      <ToggleActiveButton
        active={member.active}
        activateLabel="Ativar"
        deactivateLabel="Inativar"
        confirmTitle={member.active ? "Inativar usuário?" : "Ativar usuário?"}
        confirmDescription={
          member.active
            ? "O usuário perde acesso imediato ao sistema."
            : "O usuário volta a ter acesso ao sistema."
        }
        action={setMembershipActiveAction.bind(null, member.membershipId, !member.active)}
        {...control}
      />
    ),
  })

  return <RowActions actions={actions} label={`Ações de ${member.fullName}`} />
}
