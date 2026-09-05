"use client"

import { useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ClinicMember } from "@/services/users.service"
import type { EffectivePermission, OverrideState } from "@/services/permissions.service"
import { setUserPermissionAction } from "../actions/user.actions"

const MODULE_LABELS: Record<string, string> = {
  agenda: "Agenda",
  patients: "Pacientes",
  queue: "Fila",
  service: "Atendimento",
  records: "Prontuário",
  documents: "Documentos",
  financial: "Financeiro",
  settings: "Configurações",
  catalog: "Catálogo",
  professionals: "Profissionais",
  communication: "Comunicação",
  integrations: "Integrações",
  users: "Usuários",
  audit: "Auditoria",
  packages: "Pacotes",
}

const OPTIONS: { value: OverrideState; label: string }[] = [
  { value: "inherit", label: "Herda do papel" },
  { value: "granted", label: "Permitir" },
  { value: "denied", label: "Bloquear" },
]

function currentState(permission: EffectivePermission): OverrideState {
  if (permission.override === "granted") return "granted"
  if (permission.override === "denied") return "denied"
  return "inherit"
}

/**
 * Permissões de uma pessoa por vez.
 *
 * Substitui a matriz por papel: os cinco papéis do sistema são compartilhados entre todas
 * as clínicas, então editá-los mudaria outros tenants — e como nenhuma clínica tem papel
 * próprio, aquela tela não tinha nenhuma ação possível. Aqui o papel segue sendo o padrão e
 * a exceção é individual, que é o caso real ("esta pessoa do financeiro também cadastra
 * profissional") sem afetar todo mundo que tem o mesmo papel.
 */
export function UserPermissionMatrix({
  members,
  selectedUserId,
  permissions,
}: {
  members: ClinicMember[]
  selectedUserId: string
  permissions: EffectivePermission[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  // Só o estado otimista vive aqui. A seleção vem da URL via props — o componente é
  // remontado por `key` quando ela muda, o que também descarta este estado; sem isso a
  // matriz continuaria exibindo as permissões da pessoa anterior, já que useState ignora
  // props novas depois da montagem.
  const [rows, setRows] = useState(permissions)
  const [isPending, startTransition] = useTransition()
  const selectedId = selectedUserId

  const selected = members.find((m) => m.userId === selectedId)

  function change(permission: EffectivePermission, next: OverrideState) {
    const previous = rows
    // Otimista: a matriz inteira re-renderiza a cada clique e esperar o round trip faria o
    // controle parecer travado. O estado anterior fica guardado para desfazer em caso de erro.
    setRows((current) =>
      current.map((row) =>
        row.permission_id === permission.permission_id
          ? {
              ...row,
              override: next === "inherit" ? null : next,
              effective: next === "inherit" ? row.from_role : next === "granted",
            }
          : row
      )
    )

    startTransition(async () => {
      const result = await setUserPermissionAction(selectedId, permission.permission_id, next)
      if (result.error) {
        setRows(previous)
        toast.error(result.error)
      }
    })
  }

  const grouped = rows.reduce<Record<string, EffectivePermission[]>>((acc, row) => {
    ;(acc[row.module] ??= []).push(row)
    return acc
  }, {})

  return (
    <div className="grid gap-5">
      <div className="grid max-w-sm gap-1.5">
        <Label htmlFor="permission-user">Usuário</Label>
        <Select
          value={selectedId}
          onValueChange={(value) => {
            if (!value || value === selectedId) return
            // Navega pelo router em vez de recalcular aqui: as permissões efetivas da
            // próxima pessoa vêm da mesma função SQL que decide a autorização de verdade.
            router.push(`${pathname}?usuario=${value}`)
          }}
        >
          <SelectTrigger id="permission-user">
            <SelectValue placeholder="Selecione um usuário" />
          </SelectTrigger>
          <SelectContent>
            {members.map((member) => (
              <SelectItem key={member.userId} value={member.userId}>
                {member.fullName} — {member.roleName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selected ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Selecione um usuário para ver e ajustar as permissões dele.
        </p>
      ) : (
        <div className="grid gap-5">
          <p className="text-[0.82rem] text-muted-foreground">
            O papel <strong>{selected.roleName}</strong> define o padrão. Aqui você abre
            exceções só para {selected.fullName} — nenhuma outra pessoa com o mesmo papel é
            afetada.
          </p>

          {Object.entries(grouped).map(([module, items]) => (
            <div key={module} className="grid gap-2">
              <h3 className="text-[0.78rem] font-semibold tracking-wide text-muted-foreground uppercase">
                {MODULE_LABELS[module] ?? module}
              </h3>
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {items.map((permission) => (
                  <div
                    key={permission.permission_id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {permission.description ?? permission.slug}
                      </p>
                      <p className="font-mono text-[0.7rem] text-muted-foreground">
                        {permission.slug}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Badge
                        variant={permission.effective ? "default" : "secondary"}
                        className={cn(!permission.effective && "opacity-70")}
                      >
                        {permission.effective ? "Tem acesso" : "Sem acesso"}
                      </Badge>
                      <Select
                        value={currentState(permission)}
                        onValueChange={(value) =>
                          value && change(permission, value as OverrideState)
                        }
                        disabled={isPending}
                      >
                        <SelectTrigger
                          className="w-40"
                          aria-label={`Permissão ${permission.slug} para ${selected.fullName}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                              {option.value === "inherit" &&
                                ` (${permission.from_role ? "permitido" : "bloqueado"})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
