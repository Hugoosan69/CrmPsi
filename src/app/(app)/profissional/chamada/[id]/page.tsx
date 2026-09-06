import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { getCall } from "@/services/telehealth.service"
import { isLiveKitConfigured } from "@/lib/livekit/env"
import { EmptyState } from "@/components/shared/empty-state"
import { CallRoom } from "@/features/telehealth/components/call-room"

/**
 * A sala do profissional.
 *
 * A permissão é conferida aqui e a chamada é lida com o cliente da sessão — se for de
 * outra clínica, a RLS devolve nada e a página mostra "não encontrada". O token em si é
 * pedido pelo componente de cliente, no momento de conectar.
 */
export default async function ChamadaPage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requirePermission(PERMISSIONS.TELEHEALTH_MANAGE)
  const { id: callId } = await params

  const supabase = await createClient()
  const call = await getCall(supabase, membership.clinicId, callId)

  if (!call) {
    return <EmptyState title="Chamada não encontrada" showMascot={false} />
  }

  if (call.status === "encerrada" || call.status === "cancelada") {
    return (
      <EmptyState
        title="Esta chamada já foi encerrada"
        description="Abra uma nova sala pelo atendimento, se a consulta ainda não terminou."
        showMascot={false}
      />
    )
  }

  if (!isLiveKitConfigured()) {
    return (
      <EmptyState
        title="Teleconsulta indisponível"
        description="As credenciais do LiveKit não estão configuradas neste ambiente."
        showMascot={false}
      />
    )
  }

  return (
    <div className="grid gap-4">
      <Link
        href={`/profissional/atendimento/${call.queue_entry_id}`}
        className="inline-flex w-fit items-center gap-1 text-[0.8rem] text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Voltar ao atendimento
      </Link>
      <CallRoom callId={call.id} />
    </div>
  )
}
