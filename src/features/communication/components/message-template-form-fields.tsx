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
import type { Database } from "@/types/supabase"

type MessageTemplate = Database["public"]["Tables"]["message_templates"]["Row"]

export const MESSAGE_TYPE_LABELS: Record<string, string> = {
  confirmation: "Confirmação",
  reminder: "Lembrete",
  birthday: "Aniversário",
  post_visit: "Pós-atendimento",
  general: "Geral",
}

export const MESSAGE_CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  sms: "SMS",
  email: "E-mail",
}

export function MessageTemplateFormFields({ template }: { template?: MessageTemplate | null }) {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="type">Tipo</Label>
          <Select name="type" defaultValue={template?.type ?? "general"} required>
            <SelectTrigger id="type" className="w-full">
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
        <div className="grid gap-1.5">
          <Label htmlFor="channel">Canal</Label>
          <Select name="channel" defaultValue={template?.channel ?? "whatsapp"} required>
            <SelectTrigger id="channel" className="w-full">
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
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="subject">Assunto (e-mail, opcional)</Label>
        <Input id="subject" name="subject" defaultValue={template?.subject ?? ""} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="body_template">Conteúdo</Label>
        <Textarea
          id="body_template"
          name="body_template"
          rows={5}
          placeholder="Use {{patient_name}}, {{clinic_name}}, {{date}}..."
          defaultValue={template?.body_template ?? ""}
          required
        />
      </div>
    </div>
  )
}
