"use client"

import { useActionState, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useCloseOnSuccess } from "@/hooks/use-close-on-success"
import { renderTemplate } from "@/utils/template"
import type { Database, MessageChannel, MessageType } from "@/types/supabase"
import { sendMessageAction, type CommunicationActionState } from "../actions/communication.actions"
import { MESSAGE_CHANNEL_LABELS, MESSAGE_TYPE_LABELS } from "./message-template-form-fields"

type MessageTemplate = Database["public"]["Tables"]["message_templates"]["Row"]

const initialState: CommunicationActionState = {}

export function SendMessageDialog({
  patientId,
  templates,
  vars,
}: {
  patientId: string
  templates: MessageTemplate[]
  vars: Record<string, string>
}) {
  const [open, setOpen] = useState(false)
  const [templateId, setTemplateId] = useState("")
  const [channel, setChannel] = useState<MessageChannel>("whatsapp")
  const [type, setType] = useState<MessageType>("general")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const action = sendMessageAction.bind(null, { patientId, templateId: templateId || null })
  const [state, formAction, isPending] = useActionState(action, initialState)

  useCloseOnSuccess(state, Boolean(state.success), () => {
    setOpen(false)
    setBody("")
    setTemplateId("")
  })

  function applyTemplate(id: string) {
    setTemplateId(id)
    const template = templates.find((t) => t.id === id)
    if (template) {
      setChannel(template.channel)
      setType(template.type)
      setSubject(template.subject ?? "")
      setBody(renderTemplate(template.body_template, vars))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Enviar mensagem</Button>} />
      <DialogContent className="max-w-lg">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Enviar mensagem</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {templates.length > 0 && (
              <div className="grid gap-1.5">
                <Label>Modelo (opcional)</Label>
                <Select value={templateId} onValueChange={(v) => applyTemplate(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Mensagem livre" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {MESSAGE_TYPE_LABELS[t.type]} · {MESSAGE_CHANNEL_LABELS[t.channel]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Canal</Label>
                <Select name="channel" value={channel} onValueChange={(v) => setChannel((v ?? "whatsapp") as MessageChannel)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MESSAGE_CHANNEL_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Tipo</Label>
                <Select name="type" value={type} onValueChange={(v) => setType((v ?? "general") as MessageType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MESSAGE_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {channel === "email" && (
              <div className="grid gap-1.5">
                <Label htmlFor="subject">Assunto</Label>
                <Input id="subject" name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="body">Mensagem</Label>
              <Textarea id="body" name="body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} required />
            </div>
          </div>
          {state.error ? (
            <p className="mb-3 text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
