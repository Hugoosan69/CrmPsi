"use client"

import { useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  CalendarDays,
  Check,
  ClipboardList,
  FileText,
  FolderHeart,
  Layers,
  LayoutGrid,
  ListOrdered,
  MessageSquare,
  Minus,
  Package,
  Plug,
  ScrollText,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
  UsersRound,
  Video,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { ClinicMember } from "@/services/users.service"
import type { EffectivePermission, OverrideState } from "@/services/permissions.service"
import { setUserPermissionAction } from "../actions/user.actions"

const MODULES: Record<string, { label: string; icon: LucideIcon }> = {
  areas: { label: "Áreas de trabalho", icon: LayoutGrid },
  agenda: { label: "Agenda", icon: CalendarDays },
  patients: { label: "Pacientes", icon: Users },
  queue: { label: "Fila", icon: ListOrdered },
  service: { label: "Atendimento", icon: Stethoscope },
  records: { label: "Prontuário", icon: FolderHeart },
  documents: { label: "Documentos", icon: FileText },
  financial: { label: "Financeiro", icon: Wallet },
  settings: { label: "Configurações", icon: Settings },
  catalog: { label: "Catálogo", icon: Package },
  professionals: { label: "Profissionais", icon: UsersRound },
  communication: { label: "Comunicação", icon: MessageSquare },
  integrations: { label: "Integrações", icon: Plug },
  users: { label: "Usuários", icon: ShieldCheck },
  audit: { label: "Auditoria", icon: ScrollText },
  packages: { label: "Pacotes", icon: Layers },
  telehealth: { label: "Teleconsulta", icon: Video },
  billing: { label: "Convênios e faturamento", icon: ClipboardList },
}

/**
 * Nome de cada permissão como aparece na tela.
 *
 * O slug (`patients.view`) é identificador técnico e não diz nada a quem administra a
 * clínica; a descrição do banco serve, mas algumas foram gravadas sem acento pelas
 * migrations. Corrigir aqui evita uma migration só de texto — o que não estiver neste mapa
 * cai na descrição do banco, então uma permissão nova nunca aparece vazia.
 */
const PERMISSION_LABELS: Record<string, string> = {
  "reception.access": "Trabalhar na recepção: pacientes, agenda, fila e caixa",
  "professional.access": "Trabalhar como profissional: minha agenda, minha fila e atendimentos",
  "management.access": "Ver a área de gestão e os indicadores da clínica",
  "agenda.view": "Ver a agenda",
  "agenda.manage": "Agendar, reagendar, confirmar e cancelar",
  "agenda.configure": "Salas, horários de atendimento e bloqueios",
  "agenda.appearance": "Personalizar as cores da agenda por situação",
  "patients.view": "Ver pacientes",
  "patients.manage": "Cadastrar e editar pacientes",
  "queue.manage": "Gerenciar a fila e as chamadas",
  "service.manage": "Conduzir o atendimento clínico",
  "records.view": "Ver o prontuário",
  "documents.issue": "Emitir prescrições e documentos",
  "financial.view": "Ver o financeiro",
  "financial.view_own": "Ver o próprio financeiro (apenas os seus atendimentos)",
  "financial.manage": "Registrar pagamentos e lançamentos",
  "financial.edit_amount": "Corrigir o valor de um lançamento já registrado",
  "financial.edit_paid": "Alterar um lançamento que já está pago",
  "settings.manage": "Alterar as configurações da clínica",
  "catalog.manage": "Procedimentos, especialidades e formas de pagamento",
  "professionals.manage": "Cadastrar e editar profissionais",
  "communication.manage": "Modelos, campanhas e automações de mensagem",
  "whatsapp.connect": "Vincular o número de WhatsApp da clínica (QR code, reiniciar sessão)",
  "sandbox.toggle": "Ativar/desativar modo sandbox (banco de homologação)",
  "integrations.manage": "Configurar o servidor do WhatsApp, o n8n e pagamentos online",
  "users.manage": "Gerenciar usuários e permissões",
  "audit.view": "Ver a trilha de auditoria",
  "packages.view": "Ver pacotes de sessões",
  "packages.manage": "Vender pacotes e gerenciar o catálogo",
  "telehealth.view": "Ver teleconsultas e o histórico da chamada",
  "telehealth.manage": "Abrir teleconsulta, convidar o paciente e encerrar",
  "billing.view": "Ver tipos de cobrança, guias e protocolos",
  "billing.manage": "Cadastrar tipos de cobrança, emitir guias e fechar protocolos",
}

function labelOf(permission: EffectivePermission) {
  return PERMISSION_LABELS[permission.slug] ?? permission.description ?? "Permissão sem descrição"
}

const OPTIONS: { value: OverrideState; label: string }[] = [
  { value: "inherit", label: "Padrão" },
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
    if (next === currentState(permission)) return
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

  // `areas` primeiro, e não em ordem alfabética: é a permissão que decide se as outras
  // chegam a importar. Alguém com todas as capacidades do balcão e sem `reception.access`
  // não vê o balcão, e quem estiver depurando isso precisa topar com a área antes.
  const gruposOrdenados = Object.entries(grouped).sort(([a], [b]) =>
    a === "areas" ? -1 : b === "areas" ? 1 : 0
  )

  const totalExcecoes = rows.filter((r) => r.override !== null).length

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-border bg-card p-4">
        <div className="grid w-full max-w-sm gap-1.5">
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
            <SelectTrigger id="permission-user" className="w-full">
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

        {selected && (
          <div className="flex flex-wrap gap-2 text-[0.78rem]">
            <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
              Papel: <strong className="text-foreground">{selected.roleName}</strong>
            </span>
            <span
              className={cn(
                "rounded-full px-3 py-1",
                totalExcecoes > 0
                  ? "bg-status-warning/10 text-status-warning"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {totalExcecoes === 0
                ? "Sem exceções individuais"
                : `${totalExcecoes} ${totalExcecoes === 1 ? "exceção individual" : "exceções individuais"}`}
            </span>
          </div>
        )}
      </div>

      {!selected ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Selecione um usuário para ver e ajustar as permissões dele.
        </p>
      ) : (
        <div className="grid gap-5">
          <p className="text-[0.82rem] text-muted-foreground">
            <strong>Padrão</strong> segue o que o papel {selected.roleName} define.{" "}
            <strong>Permitir</strong> e <strong>Bloquear</strong> valem só para{" "}
            {selected.fullName} — ninguém mais com o mesmo papel é afetado.
          </p>

          <div className="grid items-start gap-4 xl:grid-cols-2">
            {gruposOrdenados.map(([module, items]) => {
              const meta = MODULES[module]
              const Icon = meta?.icon ?? ShieldCheck
              const comAcesso = items.filter((i) => i.effective).length
              return (
                <section
                  key={module}
                  className="overflow-hidden rounded-xl border border-border bg-card"
                >
                  <header className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <h3 className="text-sm font-semibold">{meta?.label ?? "Outros"}</h3>
                    </div>
                    <span className="text-[0.75rem] text-muted-foreground tabular-nums">
                      {comAcesso} de {items.length} com acesso
                    </span>
                  </header>

                  <ul className="divide-y divide-border">
                    {items.map((permission) => {
                      const estado = currentState(permission)
                      const label = labelOf(permission)
                      return (
                        <li
                          key={permission.permission_id}
                          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                        >
                          <div className="flex min-w-0 flex-1 items-start gap-2.5">
                            <span
                              className={cn(
                                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                                permission.effective
                                  ? "bg-status-success/15 text-status-success"
                                  : "bg-muted text-muted-foreground"
                              )}
                              aria-label={permission.effective ? "Tem acesso" : "Sem acesso"}
                            >
                              {permission.effective ? (
                                <Check className="size-3" />
                              ) : (
                                <Minus className="size-3" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[0.85rem] leading-snug">{label}</p>
                              <p className="mt-0.5 text-[0.72rem] text-muted-foreground">
                                {estado === "inherit" ? (
                                  <>
                                    Padrão do papel:{" "}
                                    {permission.from_role ? "permitido" : "bloqueado"}
                                  </>
                                ) : (
                                  <span className="font-medium text-status-warning">
                                    Exceção individual —{" "}
                                    {estado === "granted" ? "liberado" : "bloqueado"} só para
                                    esta pessoa
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          <div
                            role="radiogroup"
                            aria-label={`${label} para ${selected.fullName}`}
                            className="inline-flex shrink-0 rounded-lg border border-border bg-background p-0.5"
                          >
                            {OPTIONS.map((option) => {
                              const ativo = estado === option.value
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  role="radio"
                                  aria-checked={ativo}
                                  disabled={isPending}
                                  onClick={() => change(permission, option.value)}
                                  className={cn(
                                    "rounded-md px-2.5 py-1 text-[0.75rem] font-medium transition-colors disabled:opacity-60",
                                    !ativo && "text-muted-foreground hover:text-foreground",
                                    ativo && option.value === "inherit" && "bg-muted text-foreground",
                                    ativo &&
                                      option.value === "granted" &&
                                      "bg-status-success/15 text-status-success",
                                    ativo &&
                                      option.value === "denied" &&
                                      "bg-destructive/10 text-destructive"
                                  )}
                                >
                                  {option.label}
                                </button>
                              )
                            })}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
