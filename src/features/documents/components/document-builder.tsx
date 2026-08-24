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
import type { ClinicalDocumentType, Database } from "@/types/supabase"
import { issueClinicalDocumentAction, type DocumentActionState } from "../actions/document.actions"

type Template = Database["public"]["Tables"]["document_templates"]["Row"]

const TYPE_LABELS: Record<ClinicalDocumentType, string> = {
  atestado: "Atestado",
  declaracao: "Declaração",
  relatorio: "Relatório",
  encaminhamento: "Encaminhamento",
  outros: "Outros",
}

const initialState: DocumentActionState = {}

export function DocumentBuilder({
  patientId,
  professionalId,
  medicalRecordId,
  queueEntryId,
  templates,
  vars,
}: {
  patientId: string
  professionalId: string
  medicalRecordId: string | null
  queueEntryId?: string
  templates: Template[]
  vars: Record<string, string>
}) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<ClinicalDocumentType>("atestado")
  const [templateId, setTemplateId] = useState<string>("")
  const [content, setContent] = useState("")
  const action = issueClinicalDocumentAction.bind(null, { patientId, professionalId, medicalRecordId, queueEntryId })
  const [state, formAction, isPending] = useActionState(action, initialState)

  useCloseOnSuccess(state, Boolean(state.success), () => {
    setOpen(false)
    setContent("")
    setTemplateId("")
  })

  const availableTemplates = templates.filter((t) => t.type === type)

  function applyTemplate(id: string) {
    setTemplateId(id)
    const template = templates.find((t) => t.id === id)
    if (template) setContent(renderTemplate(template.body_template, vars))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Emitir documento</Button>} />
      <DialogContent className="max-w-xl">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Emitir documento</DialogTitle>
          </DialogHeader>
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="template_id" value={templateId} />
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Tipo</Label>
                <Select
                  value={type}
                  onValueChange={(value) => {
                    setType((value ?? "atestado") as ClinicalDocumentType)
                    setTemplateId("")
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Modelo</Label>
                <Select value={templateId} onValueChange={(value) => applyTemplate(value ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Em branco" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="content">Conteúdo (revise antes de emitir)</Label>
              <Textarea
                id="content"
                name="content"
                rows={10}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
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
              {isPending ? "Emitindo..." : "Emitir"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
