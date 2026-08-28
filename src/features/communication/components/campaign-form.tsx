"use client"

import { useActionState, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { PatientOption } from "@/types/options"
import { MessageComposer } from "./message-composer"
import { createCampaignAction, type CampaignActionState } from "../actions/campaign.actions"

const initialState: CampaignActionState = {}

type Audience = "active" | "inactive" | "all" | "single"

const AUDIENCES: { value: Audience; label: string; hint: string }[] = [
  {
    value: "active",
    label: "Pacientes ativos",
    hint: "Quem está em acompanhamento. O público de avisos e promoções.",
  },
  {
    value: "inactive",
    label: "Pacientes inativos",
    hint: "Quem parou de vir. Separado de propósito: reativar pede outra conversa.",
  },
  { value: "all", label: "Todos os pacientes", hint: "Ativos e inativos juntos." },
  { value: "single", label: "Uma pessoa", hint: "Um envio pontual." },
]

export function CampaignForm({ patients }: { patients: PatientOption[] }) {
  const [state, formAction, isPending] = useActionState(createCampaignAction, initialState)
  const [audience, setAudience] = useState<Audience>("active")
  const [channel, setChannel] = useState("whatsapp")
  const [schedule, setSchedule] = useState(false)

  return (
    <form action={formAction} className="grid gap-6" key={state.success ?? "form"}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="campaign-name">Nome da campanha</Label>
          <Input
            id="campaign-name"
            name="name"
            placeholder="Promoção de setembro"
            required
            autoFocus
          />
          <p className="text-[0.72rem] text-muted-foreground">
            Só para você identificar depois — o paciente não vê.
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="campaign-channel">Canal</Label>
          <Select name="channel" value={channel} onValueChange={(v) => setChannel(v ?? "whatsapp")}>
            <SelectTrigger id="campaign-channel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {channel === "email" && (
        <div className="grid gap-1.5">
          <Label htmlFor="campaign-subject">Assunto</Label>
          <Input id="campaign-subject" name="subject" placeholder="Novidades do CSIB" />
        </div>
      )}

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Quem recebe</legend>
        <input type="hidden" name="audience" value={audience} />
        <div className="grid gap-2 sm:grid-cols-2">
          {AUDIENCES.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm transition-colors",
                audience === option.value
                  ? "border-ring bg-accent/60"
                  : "border-border hover:bg-accent/30"
              )}
            >
              <input
                type="radio"
                className="mt-1"
                checked={audience === option.value}
                onChange={() => setAudience(option.value)}
              />
              <span>
                {option.label}
                <span className="block text-[0.75rem] text-muted-foreground">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {audience === "single" && (
        <div className="grid max-w-md gap-1.5">
          <Label htmlFor="campaign-patient">Paciente</Label>
          <Select name="patient_id">
            <SelectTrigger id="campaign-patient">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {patients.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.social_name || p.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <MessageComposer name="body_template" label="Mensagem" />

      <fieldset className="grid gap-2 rounded-lg border border-border p-3.5">
        <legend className="px-1 text-[0.8rem] font-medium">Quando enviar</legend>
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="radio"
            className="mt-1"
            checked={!schedule}
            onChange={() => setSchedule(false)}
          />
          <span>
            Salvar como rascunho
            <span className="block text-[0.75rem] text-muted-foreground">
              Você revisa e dispara manualmente. Nada sai agora.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="radio"
            className="mt-1"
            checked={schedule}
            onChange={() => setSchedule(true)}
          />
          <span>
            Agendar para uma data
            <span className="block text-[0.75rem] text-muted-foreground">
              Para uma promoção ou evento com dia marcado.
            </span>
          </span>
        </label>
        {schedule && (
          <Input
            type="datetime-local"
            name="scheduled_for"
            className="mt-1 max-w-xs"
            required
          />
        )}
      </fieldset>

      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-status-success" role="status">
          {state.success}
        </p>
      )}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : schedule ? "Agendar campanha" : "Salvar rascunho"}
        </Button>
      </div>
    </form>
  )
}
