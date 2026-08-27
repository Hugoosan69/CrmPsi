import { requireMembership } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { chatSchemaStatus, listChatContacts } from "@/services/internal-chat.service"
import { PageHeader } from "@/components/shared/page-header"
import { InternalChat } from "@/features/communication/components/internal-chat"

/**
 * Internal staff chat. Available to every active member — it is the team's own channel,
 * not a permissioned module. What a person can *read* is decided by participation, in RLS
 * (database/migrations/004), not by a permission slug.
 */
export default async function MensagensPage() {
  const membership = await requireMembership()
  const supabase = await createClient()

  const status = await chatSchemaStatus(supabase)

  return (
    <div className="grid animate-fade-in-up gap-6">
      <PageHeader
        title="Mensagens internas"
        description="Conversas da equipe. Nada aqui é visível ao paciente."
      />

      {status.ready ? (
        <InternalChat
          contacts={await listChatContacts(supabase, membership.clinicId, membership.userId)}
          currentUserName={membership.fullName}
        />
      ) : (
        <div className="rounded-xl border border-status-warning/40 bg-status-warning/5 px-5 py-4">
          <p className="text-sm font-medium">Mensagens internas ainda não instaladas</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Rode{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8rem] text-foreground">
              database/migrations/{status.migration}
            </code>{" "}
            no SQL Editor do Supabase para habilitar o chat da equipe e as notificações.
          </p>
        </div>
      )}
    </div>
  )
}
