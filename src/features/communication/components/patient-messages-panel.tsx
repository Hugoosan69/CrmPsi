import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import { listMessageTemplates, listMessagesForPatient } from "@/services/communication.service"
import { formatDateTime } from "@/utils/datetime"
import { MESSAGE_CHANNEL_LABELS, MESSAGE_TYPE_LABELS } from "./message-template-form-fields"
import { SendMessageDialog } from "./send-message-dialog"
import type { MessageStatus } from "@/types/supabase"

const STATUS_LABELS: Record<MessageStatus, string> = {
  queued: "Na fila",
  sent: "Enviada",
  failed: "Falhou",
  skipped: "Sem contato",
}

const STATUS_VARIANTS: Record<MessageStatus, "default" | "secondary" | "destructive" | "outline"> = {
  queued: "outline",
  sent: "default",
  failed: "destructive",
  skipped: "secondary",
}

export async function PatientMessagesPanel({
  clinicId,
  patientId,
  vars,
}: {
  clinicId: string
  patientId: string
  vars: Record<string, string>
}) {
  const supabase = await createClient()
  const [messages, templates] = await Promise.all([
    listMessagesForPatient(supabase, clinicId, patientId),
    listMessageTemplates(supabase, clinicId),
  ])

  return (
    <div className="grid gap-4">
      <div>
        <SendMessageDialog patientId={patientId} templates={templates.filter((t) => t.active)} vars={vars} />
      </div>
      {messages.length === 0 ? (
        <EmptyState title="Nenhuma mensagem registrada." />
      ) : (
        <div className="grid gap-3">
          {messages.map((message) => (
            <div key={message.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(message.created_at)} · {MESSAGE_CHANNEL_LABELS[message.channel]} ·{" "}
                  {MESSAGE_TYPE_LABELS[message.type]}
                </p>
                <Badge variant={STATUS_VARIANTS[message.status]}>{STATUS_LABELS[message.status]}</Badge>
              </div>
              {typeof message.payload === "object" && message.payload && "body" in message.payload && (
                <p className="mt-1 whitespace-pre-line text-muted-foreground">
                  {String((message.payload as Record<string, unknown>).body ?? "")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
