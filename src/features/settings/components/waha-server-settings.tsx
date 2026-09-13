"use client"

import { useActionState, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { StatusDot } from "@/components/shared/status-dot"
import type { WahaStatus } from "@/services/waha.service"
import { saveWahaAction, type WahaActionState } from "../actions/waha.actions"

const initialState: WahaActionState = {}

/**
 * Infraestrutura do WhatsApp: endereço do servidor WAHA, sessão e chave de API.
 *
 * Aqui não se lê QR nem se conecta número — isso fica em Configurações › WhatsApp, com
 * `whatsapp.connect`. Esta tela exige `integrations.manage` porque o que se edita aqui dá
 * controle total da conta de WhatsApp da clínica (migration 034).
 *
 * O estado mostrado é só se o servidor responde: é o que interessa a quem configura
 * infraestrutura, e evita duplicar aqui o fluxo de pareamento.
 */
export function WahaServerSettings({
  enabled,
  baseUrl,
  session,
  hasApiKey,
  status,
}: {
  enabled: boolean
  baseUrl: string
  session: string
  hasApiKey: boolean
  /** Nulo quando ainda não há servidor salvo. */
  status: WahaStatus | null
}) {
  const [state, formAction, isPending] = useActionState(saveWahaAction, initialState)
  const [isEnabled, setIsEnabled] = useState(enabled)

  const alcance =
    status === null
      ? ({ tone: "neutral", label: "Não configurado" } as const)
      : status.reachable
        ? ({ tone: "success", label: "Servidor respondendo" } as const)
        : ({ tone: "danger", label: "Servidor inacessível" } as const)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="text-sm">Servidor do WhatsApp (WAHA)</CardTitle>
          <StatusDot tone={alcance.tone} label={alcance.label} />
        </div>
      </CardHeader>

      <CardContent className="grid gap-5">
        <p className="text-sm text-muted-foreground">
          O WAHA mantém a sessão do WhatsApp da clínica. O vínculo do número — ler o QR code,
          reiniciar a sessão — fica em <strong>Configurações › WhatsApp</strong>, separado desta
          tela de propósito: quem relê o QR não precisa ver a chave de API.
        </p>

        {status?.error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {status.error}
          </p>
        )}

        <form action={formAction} className="grid gap-4">
          <div className="flex items-center gap-3">
            <Switch
              id="waha-enabled"
              name="enabled"
              checked={isEnabled}
              onCheckedChange={(c) => setIsEnabled(c === true)}
            />
            <Label htmlFor="waha-enabled" className="cursor-pointer">
              Usar o WAHA para enviar WhatsApp
            </Label>
          </div>

          {/* items-start: sem ele cada célula estica até a altura da linha, e um campo COM
              texto de ajuda e outro SEM ficam com os inputs em alturas diferentes. */}
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="waha-url">Servidor WAHA</Label>
              <Input
                id="waha-url"
                name="base_url"
                defaultValue={baseUrl}
                placeholder="http://64.181.189.174:3000"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="waha-session">Nome da sessão</Label>
              <Input
                id="waha-session"
                name="session"
                defaultValue={session}
                placeholder="default"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-[0.72rem] text-muted-foreground">
                Um número por sessão. &quot;default&quot; serve para uma clínica só.
              </p>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="waha-key">Chave de API</Label>
            <Input
              id="waha-key"
              name="api_key"
              type="password"
              placeholder={hasApiKey ? "•••••••• (mantida)" : "opcional, se o WAHA exigir"}
              autoComplete="new-password"
            />
            <p className="text-[0.72rem] text-muted-foreground">
              Enviada no cabeçalho <code className="font-mono">X-Api-Key</code>. Nunca sai do
              servidor.
              {hasApiKey && " Deixe vazio para manter a atual."}
            </p>
            {hasApiKey && (
              <label className="mt-1 flex items-center gap-2 text-[0.78rem] text-muted-foreground">
                <Checkbox name="clear_api_key" /> Remover a chave salva
              </label>
            )}
          </div>

          {state.error && (
            <p className="text-sm text-destructive" role="alert">
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
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
