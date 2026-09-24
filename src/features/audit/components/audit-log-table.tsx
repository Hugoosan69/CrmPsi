"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, ChevronRight, Search } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PaginationBar } from "@/components/shared/pagination-bar"
import { cn } from "@/lib/utils"
import type { AuditLogRow } from "@/services/audit.service"
import type { Json } from "@/types/supabase"

const ACTION_LABELS: Record<string, string> = {
  "appointment.create": "Agendamento criado",
  "appointment.cancel": "Agendamento cancelado",
  "appointment.confirm": "Agendamento confirmado",
  "appointment.reschedule": "Agendamento reagendado",
  "appointment.check_in": "Check-in",
  "appointment.complete": "Atendimento concluído",
  "appointment.delete": "Agendamento excluído",
  "appointment.no_show": "Falta registrada",
  "patient.create": "Paciente cadastrado",
  "patient.update": "Paciente atualizado",
  "patient.clinical_info.update": "Info clínica atualizada",
  "financial.register_payment": "Pagamento registrado",
  "financial.cancel": "Lançamento cancelado",
  "financial.edit_amount": "Valor alterado",
  "service.start": "Atendimento iniciado",
  "service.finish": "Atendimento finalizado",
  "service.pause": "Atendimento pausado",
  "service.resume": "Atendimento retomado",
  "queue.call": "Paciente chamado",
  "queue.add_walk_in": "Encaixe na fila",
  "queue.cancel": "Fila cancelada",
  "queue.release_to_queue": "Liberado para fila",
  "queue.transfer": "Transferido na fila",
  "document.issue": "Documento emitido",
  "prescription.issue": "Receituário emitido",
  "medical_record.update": "Prontuário atualizado",
  "medical_record.add_diagnosis": "Diagnóstico adicionado",
  "medical_record.remove_diagnosis": "Diagnóstico removido",
  "message.send": "Mensagem enviada",
  "message_template.create": "Template criado",
  "message_template.update": "Template atualizado",
  "automation.save": "Automação salva",
  "campaign.create": "Campanha criada",
  "campaign.dispatch": "Campanha disparada",
  "chat.retract": "Mensagem retraída",
  "user.invite": "Usuário convidado",
  "user.role_change": "Papel alterado",
  "user.update": "Usuário atualizado",
  "user.password_reset_sent": "Reset de senha enviado",
  "permission.user_override": "Permissão alterada",
  "settings.branding_update": "Identidade visual",
  "settings.integration_update": "Integração atualizada",
  "settings.integration_test": "Integração testada",
  "settings.agenda_colors": "Cores da agenda",
  "profile.update": "Perfil atualizado",
  "profile.avatar_update": "Avatar atualizado",
  "profile.password_change": "Senha alterada",
  "procedure.create": "Procedimento criado",
  "procedure.update": "Procedimento atualizado",
  "professional.create": "Profissional cadastrado",
  "professional.update": "Profissional atualizado",
  "professional.link": "Profissional vinculado",
  "specialty.create": "Especialidade criada",
  "specialty.update": "Especialidade atualizada",
  "package.catalog.create": "Pacote criado",
  "package.catalog.update": "Pacote atualizado",
  "package.sell": "Pacote vendido",
  "package.link_appointment": "Sessão vinculada",
  "package.retroactive_link": "Vínculo retroativo",
  "billing.insurer.create": "Convênio cadastrado",
  "billing.insurer.update": "Convênio atualizado",
  "billing.guide.issue": "Guia emitida",
  "billing.guide.cancel": "Guia cancelada",
  "billing.guide.email": "Guia enviada por e-mail",
  "telehealth.call.open": "Teleconsulta aberta",
  "telehealth.call.end": "Teleconsulta encerrada",
  "telehealth.invite.create": "Convite de teleconsulta",
  "availability.create": "Disponibilidade criada",
  "availability.delete": "Disponibilidade removida",
  "schedule_exception.create": "Exceção de agenda criada",
  "schedule_exception.delete": "Exceção de agenda removida",
  "room.create": "Sala criada",
  logout: "Logout",
  "sandbox.toggle": "Sandbox alternado",
}

const ENTITY_LABELS: Record<string, string> = {
  appointment: "Agendamento",
  patient: "Paciente",
  financial_transaction: "Financeiro",
  queue_entry: "Fila",
  service_session: "Atendimento",
  document: "Documento",
  prescription: "Receituário",
  medical_record: "Prontuário",
  message: "Mensagem",
  user: "Usuário",
  profile: "Perfil",
  clinic: "Clínica",
  clinic_settings: "Configurações",
  procedure: "Procedimento",
  professional: "Profissional",
  specialty: "Especialidade",
  session_package: "Pacote",
  patient_package: "Pacote do paciente",
  insurer: "Convênio",
  guide: "Guia",
  telehealth_call: "Teleconsulta",
  availability_rule: "Disponibilidade",
  schedule_exception: "Exceção",
  room: "Sala",
  campaign: "Campanha",
  message_template: "Template",
  message_automation: "Automação",
  role_permission: "Permissão",
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso))
}

function JsonDiff({ before, after }: { before: Json | null; after: Json | null }) {
  if (!before && !after) return null

  const beforeObj = before && typeof before === "object" && !Array.isArray(before) ? before : null
  const afterObj = after && typeof after === "object" && !Array.isArray(after) ? after : null

  if (afterObj && !beforeObj) {
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[0.72rem]">
        {Object.entries(afterObj).map(([key, val]) => (
          <div key={key} className="contents">
            <dt className="text-muted-foreground">{key}</dt>
            <dd className="truncate text-foreground">{String(val ?? "—")}</dd>
          </div>
        ))}
      </dl>
    )
  }

  if (beforeObj && afterObj) {
    const allKeys = [...new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)])]
    const changed = allKeys.filter(
      (k) => JSON.stringify(beforeObj[k]) !== JSON.stringify(afterObj[k])
    )
    if (changed.length === 0) return <p className="text-[0.72rem] text-muted-foreground">Sem alterações visíveis</p>

    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[0.72rem]">
        {changed.map((key) => (
          <div key={key} className="contents">
            <dt className="text-muted-foreground">{key}</dt>
            <dd className="truncate">
              <span className="text-status-danger line-through">{String(beforeObj[key] ?? "—")}</span>
              {" → "}
              <span className="text-status-success">{String(afterObj[key] ?? "—")}</span>
            </dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <pre className="max-h-32 overflow-auto whitespace-pre-wrap text-[0.68rem] text-muted-foreground">
      {JSON.stringify(after ?? before, null, 2)}
    </pre>
  )
}

function AuditRow({ row }: { row: AuditLogRow }) {
  const [open, setOpen] = useState(false)
  const hasDetail = row.before !== null || row.after !== null

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        className={cn(
          "grid w-full grid-cols-[1fr_auto] items-start gap-2 px-4 py-3 text-left",
          hasDetail && "cursor-pointer hover:bg-accent/30"
        )}
        onClick={() => hasDetail && setOpen(!open)}
        disabled={!hasDetail}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[0.82rem] font-medium">
              {ACTION_LABELS[row.action] ?? row.action}
            </span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[0.68rem] text-muted-foreground">
              {ENTITY_LABELS[row.entityType] ?? row.entityType}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-[0.72rem] text-muted-foreground">
            <span>{row.userName ?? "Sistema"}</span>
            <span className="tabular-nums">{formatDate(row.createdAt)}</span>
            {row.entityId && (
              <span className="font-mono text-[0.66rem]">{row.entityId.slice(0, 8)}</span>
            )}
          </div>
        </div>
        {hasDetail && (
          <span className="mt-1 text-muted-foreground">
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </span>
        )}
      </button>
      {open && hasDetail && (
        <div className="border-t border-dashed border-border bg-muted/30 px-4 py-3">
          <JsonDiff before={row.before} after={row.after} />
        </div>
      )}
    </div>
  )
}

export function AuditLogTable({
  rows,
  total,
  page,
  pageSize,
  entityTypes,
  actions,
  users,
  filters,
}: {
  rows: AuditLogRow[]
  total: number
  page: number
  pageSize: number
  entityTypes: string[]
  actions: string[]
  users: { id: string; name: string }[]
  filters: {
    dateFrom?: string
    dateTo?: string
    userId?: string
    entityType?: string
    action?: string
    search?: string
  }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function setFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams)
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete("pagina")
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="grid gap-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute top-2.5 left-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar ação..."
            defaultValue={filters.search ?? ""}
            className="h-9 w-48 pl-8 text-[0.82rem]"
            onKeyDown={(e) => {
              if (e.key === "Enter") setFilter("busca", (e.target as HTMLInputElement).value || null)
            }}
          />
        </div>

        <Input
          type="date"
          defaultValue={filters.dateFrom ?? ""}
          className="h-9 w-36 text-[0.82rem]"
          onChange={(e) => setFilter("de", e.target.value || null)}
        />
        <Input
          type="date"
          defaultValue={filters.dateTo ?? ""}
          className="h-9 w-36 text-[0.82rem]"
          onChange={(e) => setFilter("ate", e.target.value || null)}
        />

        <Select
          value={filters.userId ?? "all"}
          onValueChange={(v) => setFilter("usuario", v === "all" ? null : v)}
        >
          <SelectTrigger className="h-9 w-44 text-[0.82rem]">
            <SelectValue placeholder="Usuário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os usuários</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.entityType ?? "all"}
          onValueChange={(v) => setFilter("entidade", v === "all" ? null : v)}
        >
          <SelectTrigger className="h-9 w-40 text-[0.82rem]">
            <SelectValue placeholder="Entidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as entidades</SelectItem>
            {entityTypes.map((et) => (
              <SelectItem key={et} value={et}>
                {ENTITY_LABELS[et] ?? et}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.action ?? "all"}
          onValueChange={(v) => setFilter("acao", v === "all" ? null : v)}
        >
          <SelectTrigger className="h-9 w-48 text-[0.82rem]">
            <SelectValue placeholder="Ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>
                {ACTION_LABELS[a] ?? a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {Object.values(filters).some(Boolean) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => router.push(pathname, { scroll: false })}
          >
            Limpar
          </Button>
        )}
      </div>

      {/* Lista */}
      <div className="rounded-xl border border-border bg-card">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum registro de auditoria encontrado.
          </p>
        ) : (
          rows.map((row) => <AuditRow key={row.id} row={row} />)
        )}
      </div>

      <PaginationBar total={total} page={page} pageSize={pageSize} label="registros" />
    </div>
  )
}
