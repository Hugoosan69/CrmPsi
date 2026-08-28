"use client"

import { useActionState, useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { StatusDot } from "@/components/shared/status-dot"
import type { MessageChannel } from "@/types/supabase"
import {
  saveN8nAction,
  testN8nAction,
  type SettingsActionState,
} from "../actions/settings.actions"

const initialState: SettingsActionState = {}

const CHANNELS: { value: MessageChannel; label: string; hint: string }[] = [
  { value: "whatsapp", label: "WhatsApp", hint: "usa o WhatsApp do paciente, ou o telefone" },
  { value: "sms", label: "SMS", hint: "usa o telefone" },
  { value: "email", label: "E-mail", hint: "usa o e-mail" },
]

/**
 * The secret is never sent to the browser — the server only reports whether one is stored.
 * An empty field on submit means "keep it", which is what allows this form to be saved
 * repeatedly without the operator retyping the token.
 */
export function N8nSettings({
  enabled,
  baseUrl: initialBaseUrl,
  path: initialPath,
  webhookUrl,
  hasSecret,
  channels,
}: {
  enabled: boolean
  baseUrl: string
  path: string
  webhookUrl: string
  hasSecret: boolean
  channels: MessageChannel[]
}) {
  const [state, formAction, isPending] = useActionState(saveN8nAction, initialState)
  const [isEnabled, setIsEnabled] = useState(enabled)
  const [isTesting, startTest] = useTransition()
  const [baseUrl, setBaseUrl] = useState(initialBaseUrl)
  const [path, setPath] = useState(initialPath)

  // Prévia ao vivo das URLs. Repete a composição do servidor de propósito: mostrar aqui o
  // que o backend derivaria exige a mesma regra, e escondê-la faria o operador salvar às
  // cegas para descobrir o endereço só no teste.
  const cleanBase = baseUrl.trim().replace(/\/+$/, "")
  const cleanPath = path.trim().replace(/^\/+|\/+$/g, "")
  const composed =
    cleanBase && cleanPath
      ? {
          production: `${cleanBase}/webhook/${cleanPath}`,
          test: `${cleanBase}/webhook-test/${cleanPath}`,
        }
      : null
  // Testável quando há destino GRAVADO — a prévia acima pode estar adiante do que foi salvo.
  const hasTarget = Boolean(webhookUrl) || Boolean(initialBaseUrl && initialPath)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="text-sm">Mensageria via n8n</CardTitle>
          <StatusDot
            tone={enabled && hasTarget ? "success" : "neutral"}
            label={enabled && hasTarget ? "Ativa" : "Inativa — mensagens são simuladas"}
          />
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <p className="text-sm text-muted-foreground">
          O CSIB envia um POST em JSON por mensagem e o n8n cuida do provedor (WhatsApp
          Cloud API, SMS, e-mail). Nenhuma credencial de provedor fica neste sistema, e a
          clínica muda o comportamento dos canais sem novo deploy. Canais que não estiverem
          marcados continuam apenas simulados no log do servidor.
        </p>

        <form action={formAction} className="grid gap-4">
          <div className="flex items-center gap-3">
            <Switch
              id="n8n-enabled"
              name="enabled"
              checked={isEnabled}
              onCheckedChange={(checked) => setIsEnabled(checked === true)}
            />
            <Label htmlFor="n8n-enabled" className="cursor-pointer">
              Enviar mensagens pelo n8n
            </Label>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="n8n-base">Servidor n8n</Label>
            <Input
              id="n8n-base"
              name="base_url"
              defaultValue={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://64.181.189.174:5678"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-[0.75rem] text-muted-foreground">
              Só o endereço da máquina, com porta e sem caminho. Precisa ser alcançável a
              partir do servidor onde o CSIB roda — um n8n em rede interna não funciona se a
              aplicação estiver hospedada fora dela.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="n8n-path">Caminho do webhook</Label>
            <Input
              id="n8n-path"
              name="path"
              defaultValue={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="csib"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-[0.75rem] text-muted-foreground">
              O campo <strong>Path</strong> do nó Webhook no n8n — só o nome, sem barras.
            </p>
          </div>

          {/* O n8n expõe dois endereços para o mesmo nó, e confundi-los é a causa mais comum
              de "testei e deu 404": o de teste só responde enquanto o editor está com
              "Listen for test event" ligado, e o de produção só existe com o workflow ativo. */}
          {composed && (
            <div className="grid gap-1 rounded-lg border border-border bg-muted/40 px-3.5 py-3 text-[0.78rem]">
              <p className="font-medium">URLs que serão usadas</p>
              <p className="text-muted-foreground">
                Produção:{" "}
                <code className="font-mono break-all">{composed.production}</code>
              </p>
              <p className="text-muted-foreground">
                Teste: <code className="font-mono break-all">{composed.test}</code>
              </p>
            </div>
          )}

          {/* Mantido para não perder a configuração de quem salvou antes de existirem os
              campos separados. Quando servidor e caminho estão preenchidos, eles vencem. */}
          {webhookUrl && !composed && (
            <div className="grid gap-1.5">
              <Label htmlFor="n8n-webhook">URL completa (formato antigo)</Label>
              <Input
                id="n8n-webhook"
                name="webhook_url"
                defaultValue={webhookUrl}
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-[0.75rem] text-muted-foreground">
                Preencha servidor e caminho acima para substituir este campo.
              </p>
            </div>
          )}
          {(!webhookUrl || composed) && (
            <input type="hidden" name="webhook_url" value={webhookUrl} />
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="n8n-secret">Token de autenticação</Label>
            <Input
              id="n8n-secret"
              name="secret"
              type="password"
              placeholder={hasSecret ? "•••••••• (mantido)" : "opcional"}
              autoComplete="new-password"
            />
            <p className="text-[0.75rem] text-muted-foreground">
              Enviado no cabeçalho <code className="font-mono">X-CSIB-Token</code>. Valide-o
              no início do seu fluxo n8n para que ninguém mais consiga acionar o webhook.
              {hasSecret
                ? " Deixe vazio para manter o token atual."
                : " Deixe vazio se o webhook não exige autenticação."}
            </p>
            {hasSecret && (
              <label className="mt-1 flex items-center gap-2 text-[0.78rem] text-muted-foreground">
                <Checkbox name="clear_secret" /> Remover o token salvo
              </label>
            )}
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Canais roteados pelo n8n</legend>
            {CHANNELS.map((channel) => (
              <label key={channel.value} className="flex items-start gap-2.5 text-sm">
                <Checkbox
                  name="channels"
                  value={channel.value}
                  defaultChecked={channels.includes(channel.value)}
                  className="mt-0.5"
                />
                <span>
                  {channel.label}
                  <span className="block text-[0.75rem] text-muted-foreground">{channel.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

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
              {isPending ? "Salvando..." : "Salvar integração"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isTesting || !hasTarget}
              onClick={() =>
                startTest(async () => {
                  const result = await testN8nAction("production")
                  if (result.error) toast.error(result.error)
                  else if (result.success) toast.success(result.success)
                })
              }
            >
              {isTesting ? "Testando..." : "Testar produção"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isTesting || !hasTarget}
              onClick={() =>
                startTest(async () => {
                  const result = await testN8nAction("test")
                  if (result.error) toast.error(result.error)
                  else if (result.success) toast.success(result.success)
                })
              }
            >
              Testar URL de teste
            </Button>
          </div>
          <p className="text-[0.75rem] text-muted-foreground">
            O nó Webhook no n8n precisa estar em <strong>HTTP Method: POST</strong> — o CSIB
            envia o corpo da mensagem em JSON. Com o nó em GET o n8n responde 404 dizendo que
            o webhook não está registrado para POST, o que se parece com erro de endereço.
          </p>
          <p className="text-[0.75rem] text-muted-foreground">
            O teste usa a configuração <strong>gravada</strong>, não o que está no
            formulário — salve antes. &quot;Testar URL de teste&quot; só responde enquanto o
            editor do n8n estiver com &quot;Listen for test event&quot; ligado; a de produção
            exige o workflow ativo.
          </p>
        </form>

        <details className="rounded-lg border border-border bg-muted/40 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium">
            Formato do payload enviado ao n8n
          </summary>
          <pre className="mt-3 overflow-x-auto text-[0.72rem] leading-relaxed">
            {`{
  "clinicId":   "uuid da clínica",
  "patientId":  "uuid do paciente",
  "type":       "confirmation | reminder | birthday | post_visit | custom",
  "channel":    "whatsapp | sms | email",
  "to":         "destino já resolvido do cadastro do paciente",
  "subject":    "assunto ou null",
  "body":       "texto final, com as variáveis já substituídas",
  "requestedAt":"ISO 8601"
}`}
          </pre>
          <p className="mt-3 text-[0.75rem] text-muted-foreground">
            Responda 2xx para o CSIB marcar a mensagem como enviada. Qualquer outro status,
            ou timeout de 15 s, grava a mensagem como falha com o corpo da resposta anexado
            — visível na aba Mensagens do paciente.
          </p>
        </details>
      </CardContent>
    </Card>
  )
}
