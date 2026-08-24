import { EmptyState } from "@/components/shared/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ToggleActiveButton } from "@/components/shared/toggle-active-button"
import type { Database } from "@/types/supabase"
import { setMessageTemplateActiveAction } from "../actions/communication.actions"
import { EditMessageTemplateDialog } from "./edit-message-template-dialog"
import { MESSAGE_CHANNEL_LABELS, MESSAGE_TYPE_LABELS } from "./message-template-form-fields"

type MessageTemplate = Database["public"]["Tables"]["message_templates"]["Row"]

export function MessageTemplatesTable({ templates }: { templates: MessageTemplate[] }) {
  if (templates.length === 0) {
    return (
      <EmptyState title="Nenhum modelo cadastrado." />
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tipo</TableHead>
          <TableHead>Canal</TableHead>
          <TableHead>Conteúdo</TableHead>
          <TableHead className="w-1" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {templates.map((template) => (
          <TableRow key={template.id}>
            <TableCell className="font-medium">
              {MESSAGE_TYPE_LABELS[template.type]}
              {!template.active && (
                <Badge variant="secondary" className="ml-2">
                  Inativo
                </Badge>
              )}
            </TableCell>
            <TableCell>{MESSAGE_CHANNEL_LABELS[template.channel]}</TableCell>
            <TableCell className="max-w-sm truncate text-muted-foreground">{template.body_template}</TableCell>
            <TableCell className="flex justify-end gap-1 text-right">
              <EditMessageTemplateDialog template={template} />
              <ToggleActiveButton
                active={template.active}
                deactivateLabel="Inativar"
                confirmTitle={template.active ? "Inativar modelo?" : "Ativar modelo?"}
                confirmDescription={
                  template.active
                    ? "O modelo deixará de aparecer como opção ao enviar mensagens."
                    : "O modelo voltará a aparecer como opção ao enviar mensagens."
                }
                action={setMessageTemplateActiveAction.bind(null, template.id, !template.active)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
