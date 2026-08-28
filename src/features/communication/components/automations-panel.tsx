"use client"

import { useActionState, useState } from "react"
import { Cake, CalendarCheck, Clock, Star } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Automation } from "@/services/communication.service"
import { saveAutomationAction, type CampaignActionState } from "../actions/campaign.actions"

const initialState: CampaignActionState = {}

type AutomationType = "confirmation" | "reminder" | "birthday" | "post_visit"

/**
 * As quatro automações que a clínica realmente usa, cada uma com o vocabulário do seu
 * gatilho. `offset_minutes` no banco é um número assinado só, mas expor "minutos" cru faria
 * o operador calcular 1440 de cabeça para dizer "um dia antes".
 */
const AUTOMATIONS: {
  type: AutomationType
  label: string
  description: string
  icon: typeof Cake
  /** Opções de deslocamento, já em minutos, com o rótulo que faz sentido para o gatilho. */
  offsets: { value: string; label: string }[]
  /** Aniversário não tem evento com hora; precisa de um horário do dia. */
  usesTimeOfDay?: boolean
}[] = [
  {
    type: "confirmation",
    label: "Confirmação de consulta",
    description: "Sai quando o agendamento é criado, pedindo que o paciente confirme.",
    icon: CalendarCheck,
    offsets: [
      { value: "0", label: "Assim que agendar" },
      { value: "-2880", label: "2 dias antes" },
      { value: "-1440", label: "1 dia antes" },
    ],
  },
  {
    type: "reminder",
    label: "Lembrete de consulta",
    description: "Reduz falta. O horário conta a partir da consulta.",
    icon: Clock,
    offsets: [
      { value: "-1440", label: "1 dia antes" },
      { value: "-180", label: "3 horas antes" },
      { value: "-60", label: "1 hora antes" },
    ],
  },
  {
    type: "birthday",
    label: "Aniversário",
    description: "Uma mensagem no dia, no horário que você escolher.",
    icon: Cake,
    offsets: [{ value: "0", label: "No dia" }],
    usesTimeOfDay: true,
  },
  {
    type: "post_visit",
    label: "Pedido de avaliação",
    description: "Depois do atendimento concluído, pedindo a opinião do paciente.",
    icon: Star,
    offsets: [
      { value: "120", label: "2 horas depois" },
      { value: "1440", label: "1 dia depois" },
      { value: "4320", label: "3 dias depois" },
    ],
  },
]

export function AutomationsPanel({
  automations,
  templates,
}: {
  automations: Automation[]
  templates: { id: string; type: string; body_template: string }[]
}) {
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Automações disparam sozinhas a partir de um evento — não têm data marcada, têm
        gatilho. Cada uma usa um modelo da aba Modelos.
      </p>
      {AUTOMATIONS.map((config) => (
        <AutomationCard
          key={config.type}
          config={config}
          current={automations.find((a) => a.type === config.type)}
          templates={templates.filter((t) => t.type === config.type)}
        />
      ))}
    </div>
  )
}

function AutomationCard({
  config,
  current,
  templates,
}: {
  config: (typeof AUTOMATIONS)[number]
  current?: Automation
  templates: { id: string; body_template: string }[]
}) {
  const [state, formAction, isPending] = useActionState(saveAutomationAction, initialState)
  const [enabled, setEnabled] = useState(current?.enabled ?? false)
  const Icon = config.icon

  return (
    <form action={formAction} className="rounded-xl border border-border bg-card p-4">
      <input type="hidden" name="type" value={config.type} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <span
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"
            aria-hidden
          >
            <Icon className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium">{config.label}</p>
            <p className="text-[0.78rem] text-muted-foreground">{config.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id={`auto-${config.type}`}
            name="enabled"
            checked={enabled}
            onCheckedChange={(c) => setEnabled(c === true)}
          />
          <Label htmlFor={`auto-${config.type}`} className="cursor-pointer text-[0.82rem]">
            {enabled ? "Ativa" : "Inativa"}
          </Label>
        </div>
      </div>

      {enabled && (
        <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor={`when-${config.type}`}>Quando</Label>
            <Select
              name="offset_minutes"
              defaultValue={String(current?.offset_minutes ?? config.offsets[0].value)}
            >
              <SelectTrigger id={`when-${config.type}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {config.offsets.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {config.usesTimeOfDay && (
            <div className="grid gap-1.5">
              <Label htmlFor={`time-${config.type}`}>Horário</Label>
              <Input
                id={`time-${config.type}`}
                name="send_at_time"
                type="time"
                defaultValue={current?.send_at_time?.slice(0, 5) ?? "09:00"}
              />
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor={`channel-${config.type}`}>Canal</Label>
            <Select name="channel" defaultValue={current?.channel ?? "whatsapp"}>
              <SelectTrigger id={`channel-${config.type}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`tpl-${config.type}`}>Modelo</Label>
            <Select name="template_id" defaultValue={current?.template_id ?? ""}>
              <SelectTrigger id={`tpl-${config.type}`}>
                <SelectValue placeholder={templates.length ? "Selecione" : "Nenhum cadastrado"} />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.body_template.slice(0, 40)}
                    {t.body_template.length > 40 ? "…" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {templates.length === 0 && (
              <p className="text-[0.72rem] text-muted-foreground">
                Cadastre um modelo deste tipo na aba Modelos.
              </p>
            )}
          </div>
        </div>
      )}

      {state.error && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mt-3 text-sm text-status-success" role="status">
          {state.success}
        </p>
      )}

      <div className="mt-4">
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  )
}
