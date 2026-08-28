"use client"

import { useRef, useState } from "react"
import { AlertTriangle, GripVertical, Sparkles } from "lucide-react"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { MESSAGE_PRESETS, unfilledPlaceholders } from "@/config/message-presets"
import {
  MESSAGE_VARIABLES,
  VARIABLE_GROUP_LABEL,
  renderTemplate,
  sampleValues,
  unknownVariables,
  usesAppointmentVariables,
  variableToken,
  type MessageVariable,
} from "@/config/message-variables"

/**
 * Editor de mensagem com variáveis arrastáveis.
 *
 * Cada bloco pode ser ARRASTADO para a posição desejada ou CLICADO para inserir no ponto do
 * cursor. Os dois caminhos existem de propósito: arrastar é o gesto que a pessoa menos
 * técnica descobre sozinha, mas depende de mouse — não funciona no toque nem no teclado, e
 * sozinho deixaria a tela inutilizável para quem navega assim. O clique é o caminho que
 * sempre funciona; o arrasto é o atalho.
 *
 * A pré-visualização usa valores de exemplo em vez de deixar as chaves à mostra: o operador
 * precisa ver a frase que o paciente vai ler, não a sintaxe.
 */
export function MessageComposer({
  name,
  defaultValue = "",
  label = "Mensagem",
  rows = 8,
  /** Campanha para vários pacientes: aí variáveis de consulta ficam vazias para quem não
   *  tem agendamento futuro, e vale avisar antes do disparo. */
  warnAboutAppointmentVars = false,
}: {
  name: string
  defaultValue?: string
  label?: string
  rows?: number
  warnAboutAppointmentVars?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState(defaultValue)
  const [dragOver, setDragOver] = useState(false)

  /** Insere no cursor (ou na posição do drop) e devolve o foco logo depois do inserido. */
  function insertAt(token: string, position?: number) {
    const el = ref.current
    if (!el) return
    const at = position ?? el.selectionStart ?? text.length
    const next = text.slice(0, at) + token + text.slice(at)
    setText(next)
    requestAnimationFrame(() => {
      el.focus()
      const caret = at + token.length
      el.setSelectionRange(caret, caret)
    })
  }

  /**
   * Posição do caractere sob o ponteiro no momento do drop. Sem isto o bloco arrastado
   * cairia sempre no fim do texto, o que faz o arrasto parecer quebrado — a pessoa mirou um
   * lugar específico.
   */
  function caretFromPoint(event: React.DragEvent<HTMLTextAreaElement>): number | undefined {
    const doc = document as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offset: number } | null
      caretRangeFromPoint?: (x: number, y: number) => Range | null
    }
    const pos = doc.caretPositionFromPoint?.(event.clientX, event.clientY)
    if (pos) return pos.offset
    const range = doc.caretRangeFromPoint?.(event.clientX, event.clientY)
    return range?.startOffset
  }

  const unknown = unknownVariables(text)
  const preview = renderTemplate(text, sampleValues())
  // Trechos [assim] vêm dos modelos prontos e precisam ser trocados por texto de verdade.
  const pending = unfilledPlaceholders(text)

  const grouped = MESSAGE_VARIABLES.reduce<Record<string, MessageVariable[]>>((acc, v) => {
    ;(acc[v.group] ??= []).push(v)
    return acc
  }, {})

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_15rem]">
      <div className="grid gap-4">
        {/* Começar de uma caixa vazia é onde a maioria desiste. Os modelos são ponto de
            partida editável, não texto fixo — por isso substituem o conteúdo em vez de
            enviar direto. */}
        <details className="rounded-lg border border-border bg-muted/40 px-3.5 py-2.5">
          <summary className="cursor-pointer text-[0.82rem] font-medium">
            <Sparkles className="mr-1.5 inline size-3.5 text-muted-foreground" aria-hidden />
            Usar um modelo pronto
          </summary>
          <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {MESSAGE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setText(preset.body)
                  requestAnimationFrame(() => ref.current?.focus())
                }}
                className="rounded-lg border border-border bg-card px-3 py-2 text-left text-[0.8rem] transition-colors hover:border-ring/40 hover:bg-accent"
              >
                <span className="block font-medium">{preset.label}</span>
                <span className="block text-[0.72rem] text-muted-foreground">{preset.hint}</span>
              </button>
            ))}
          </div>
        </details>

        <div className="grid gap-1.5">
          <Label htmlFor={`composer-${name}`}>{label}</Label>
          <Textarea
            id={`composer-${name}`}
            name={name}
            ref={ref}
            rows={rows}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              const key = e.dataTransfer.getData("text/csib-variable")
              if (!key) return // arrasto de outra origem: deixa o navegador colar o texto
              e.preventDefault()
              setDragOver(false)
              insertAt(variableToken(key), caretFromPoint(e))
            }}
            className={cn(
              "font-mono text-[0.85rem] transition-colors",
              dragOver && "border-ring ring-3 ring-ring/30"
            )}
            placeholder="Escreva a mensagem e arraste as variáveis para dentro dela."
          />
        </div>

        {unknown.length > 0 && (
          <div
            className="flex gap-2.5 rounded-lg border border-status-warning/40 bg-status-warning/5 px-3.5 py-3"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-warning" aria-hidden />
            <p className="text-[0.82rem] text-muted-foreground">
              {unknown.length === 1 ? "A variável " : "As variáveis "}
              {unknown.map((k) => (
                <code key={k} className="font-mono">
                  {variableToken(k)}
                </code>
              ))}{" "}
              {unknown.length === 1 ? "não existe" : "não existem"} — no envio{" "}
              {unknown.length === 1 ? "ela vira" : "elas viram"} texto vazio. Use os blocos ao
              lado.
            </p>
          </div>
        )}

        {warnAboutAppointmentVars && usesAppointmentVariables(text) && (
          <div
            className="flex gap-2.5 rounded-lg border border-status-info/40 bg-status-info/5 px-3.5 py-3"
            role="status"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-info" aria-hidden />
            <p className="text-[0.82rem] text-muted-foreground">
              Esta mensagem usa dados da consulta. Pacientes <strong>sem consulta futura
              marcada</strong> seriam pulados no disparo — a frase sairia com lacunas. A
              pré-visualização acima usa dados de exemplo e não mostra isso.
            </p>
          </div>
        )}

        {pending.length > 0 && (
          <div
            className="flex gap-2.5 rounded-lg border border-status-warning/40 bg-status-warning/5 px-3.5 py-3"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-warning" aria-hidden />
            <p className="text-[0.82rem] text-muted-foreground">
              Falta preencher: {pending.map((p) => `[${p}]`).join(", ")}. Os colchetes vão para
              o paciente exatamente como estão.
            </p>
          </div>
        )}

        <div className="grid gap-1.5">
          <Label>Pré-visualização</Label>
          <div className="min-h-20 rounded-xl border border-border bg-muted/40 px-4 py-3 text-[0.88rem] whitespace-pre-wrap">
            {preview || (
              <span className="text-muted-foreground">
                A mensagem aparece aqui com dados de exemplo.
              </span>
            )}
          </div>
          <p className="text-[0.72rem] text-muted-foreground">
            Valores de exemplo. No envio cada paciente recebe os próprios dados.
          </p>
        </div>
      </div>

      <div className="grid content-start gap-3">
        <Label>Variáveis</Label>
        <p className="-mt-1 text-[0.72rem] text-muted-foreground">
          Arraste para dentro da mensagem, ou clique para inserir onde o cursor está.
        </p>

        {Object.entries(grouped).map(([group, vars]) => (
          <div key={group} className="grid gap-1.5">
            <p className="text-[0.66rem] font-semibold tracking-[0.08em] text-muted-foreground/70 uppercase">
              {VARIABLE_GROUP_LABEL[group as MessageVariable["group"]]}
            </p>
            {vars.map((v) => (
              <button
                key={v.key}
                type="button"
                draggable
                onDragStart={(e) => {
                  // Tipo próprio para o textarea distinguir este arrasto de um texto
                  // qualquer arrastado de fora da página.
                  e.dataTransfer.setData("text/csib-variable", v.key)
                  e.dataTransfer.setData("text/plain", variableToken(v.key))
                  e.dataTransfer.effectAllowed = "copy"
                }}
                onClick={() => insertAt(variableToken(v.key))}
                className="flex cursor-grab items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-left text-[0.78rem] transition-colors hover:border-ring/40 hover:bg-accent active:cursor-grabbing"
              >
                <GripVertical className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{v.label}</span>
                  <code className="block truncate font-mono text-[0.68rem] text-muted-foreground">
                    {variableToken(v.key)}
                  </code>
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
