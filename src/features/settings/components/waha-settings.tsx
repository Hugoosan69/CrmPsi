"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { RefreshCw, Smartphone } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { StatusDot } from "@/components/shared/status-dot"
import type { WahaStatus } from "@/services/waha.service"
import {
  logoutWahaAction,
  refreshWahaQrAction,
  saveWahaAction,
  startWahaAction,
  type WahaActionState,
} from "../actions/waha.actions"

const initialState: WahaActionState = {}

/** Vocabulário do WAHA traduzido para o que o operador precisa fazer a seguir. */
const STATUS_TEXT: Record<string, { label: string; tone: "success" | "warning" | "neutral" | "danger" }> = {
  WORKING: { label: "Conectado", tone: "success" },
  SCAN_QR_CODE: { label: "Aguardando leitura do QR code", tone: "warning" },
  STARTING: { label: "Iniciando...", tone: "warning" },
  STOPPED: { label: "Parado", tone: "neutral" },
  NOT_CREATED: { label: "Sessão ainda não criada", tone: "neutral" },
  FAILED: { label: "Falhou", tone: "danger" },
}

export function WahaSettings({
  enabled,
  baseUrl,
  session,
  hasApiKey,
  status,
  initialQr,
}: {
  enabled: boolean
  baseUrl: string
  session: string
  hasApiKey: boolean
  status: WahaStatus
  /** data:image/png;base64,... já resolvido no servidor. */
  initialQr: string | null
}) {
  const [state, formAction, isPending] = useActionState(saveWahaAction, initialState)
  const [isEnabled, setIsEnabled] = useState(enabled)
  const [isWorking, startWork] = useTransition()
  const [qr, setQr] = useState(initialQr)
  const [isRefreshing, startRefresh] = useTransition()

  const waitingQr = status.status === "SCAN_QR_CODE"
  const info = status.status ? STATUS_TEXT[status.status] : null

  useEffect(() => {
    if (!waitingQr) return
    // O WAHA rotaciona o código; sem buscar de novo, o operador miraria um QR já vencido.
    const id = setInterval(() => {
      void refreshWahaQrAction().then((r) => setQr(r.dataUri))
    }, 20_000)
    return () => clearInterval(id)
  }, [waitingQr])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="text-sm">WhatsApp da clínica (WAHA)</CardTitle>
          <StatusDot
            tone={info?.tone ?? (status.reachable ? "neutral" : "danger")}
            label={
              status.reachable
                ? (info?.label ?? "Estado desconhecido")
                : "Servidor inacessível"
            }
          />
        </div>
      </CardHeader>

      <CardContent className="grid gap-5">
        <p className="text-sm text-muted-foreground">
          O WAHA mantém a sessão do WhatsApp da clínica. Você lê o QR code uma vez com o
          celular do número da clínica, e a partir daí as mensagens saem por ele. O número
          fica conectado até você desconectar aqui ou desvincular no aparelho.
        </p>

        {status.me && (
          <div className="flex items-center gap-2.5 rounded-lg border border-status-success/40 bg-status-success/5 px-3.5 py-3">
            <Smartphone className="size-4 shrink-0 text-status-success" aria-hidden />
            <p className="text-[0.85rem]">
              Conectado como{" "}
              <strong>{status.me.pushName || status.me.id.replace(/@.*/, "")}</strong>
              <span className="block text-[0.75rem] text-muted-foreground">
                {status.me.id.replace(/@.*/, "")}
              </span>
            </p>
          </div>
        )}

        {status.error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {status.error}
          </p>
        )}

        {waitingQr && (
          <div className="grid justify-items-center gap-3 rounded-xl border border-border bg-muted/40 p-5">
            <p className="text-[0.85rem] font-medium">Leia com o WhatsApp da clínica</p>
            <p className="-mt-1 max-w-sm text-center text-[0.78rem] text-muted-foreground">
              No celular: Configurações → Aparelhos conectados → Conectar um aparelho.
            </p>
            {/* next/image não serve para um data URI que muda a cada segundos e não deve
                ser otimizado nem cacheado. */}
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr}
                alt="QR code para conectar o WhatsApp"
                className="size-56 rounded-lg bg-white p-2"
              />
            ) : (
              <div className="flex size-56 items-center justify-center rounded-lg border border-dashed border-border text-center text-[0.78rem] text-muted-foreground">
                QR ainda não disponível.
                <br />
                Aguarde alguns segundos.
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={isRefreshing}
              onClick={() =>
                startRefresh(async () => {
                  const r = await refreshWahaQrAction()
                  setQr(r.dataUri)
                })
              }
              aria-label="Gerar novo QR code"
            >
              <RefreshCw className="size-3.5" />
              {isRefreshing ? "Buscando..." : "Atualizar QR"}
            </Button>
          </div>
        )}

        <form action={formAction} className="grid gap-4 border-t border-border pt-5">
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

          {/* items-start é necessário: sem ele cada célula estica até a altura da linha e
              distribui o conteúdo, então um campo COM texto de ajuda e outro SEM ficam com
              os inputs em alturas diferentes — 27px de diferença, medido. */}
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

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>

            {status.status !== "WORKING" && (
              <Button
                type="button"
                variant="outline"
                disabled={isWorking || !baseUrl}
                onClick={() =>
                  startWork(async () => {
                    const r = await startWahaAction()
                    if (r.error) toast.error(r.error)
                    else if (r.success) toast.success(r.success)
                  })
                }
              >
                {isWorking ? "Conectando..." : "Conectar número"}
              </Button>
            )}

            {status.me && (
              <Button
                type="button"
                variant="outline"
                disabled={isWorking}
                onClick={() =>
                  startWork(async () => {
                    const r = await logoutWahaAction()
                    if (r.error) toast.error(r.error)
                    else if (r.success) toast.success(r.success)
                  })
                }
              >
                Desconectar número
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
