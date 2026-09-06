import { MessageSquare, Video } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { listCallsForPatient, type PatientCall } from "@/services/telehealth.service"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusDot, type StatusTone } from "@/components/shared/status-dot"
import type { VideoCallStatus } from "@/types/supabase"

const STATUS: Record<VideoCallStatus, { label: string; tone: StatusTone }> = {
  aguardando: { label: "Aguardando", tone: "warning" },
  em_andamento: { label: "Em andamento", tone: "success" },
  encerrada: { label: "Encerrada", tone: "neutral" },
  cancelada: { label: "Cancelada", tone: "danger" },
}

/** "12 min" / "1h 05" — a leitura que interessa numa lista de consultas. */
function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—"
  const minutos = Math.round(seconds / 60)
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  return `${horas}h ${String(minutos % 60).padStart(2, "0")}`
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
}

function CallRow({ call }: { call: PatientCall }) {
  const status = STATUS[call.status]
  const quem = call.participants
    .map((p) => p.displayName ?? (p.papel === "atendente" ? "Profissional" : "Paciente"))
    .join(" · ")

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-border px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[0.875rem] font-medium">
            {formatDateTime(call.startedAt ?? call.createdAt)}
          </p>
          <StatusDot tone={status.tone} label={status.label} />
        </div>
        <p className="truncate text-[0.75rem] text-muted-foreground">
          {quem || "Ninguém registrado na sala"}
          {call.messageCount > 0 && (
            <span className="ml-2 inline-flex items-center gap-1">
              <MessageSquare className="size-3" aria-hidden />
              {call.messageCount}
            </span>
          )}
        </p>
      </div>
      <span className="shrink-0 text-[0.875rem] font-medium tabular-nums">
        {formatDuration(call.durationSeconds)}
      </span>
    </li>
  )
}

/**
 * As teleconsultas do paciente, na ficha.
 *
 * Duração só aparece em chamada encerrada: uma sala aberta e nunca fechada cresceria para
 * sempre no histórico, o que engana mais do que informa. Enquanto não há webhook (fase 4),
 * quem participou vem vazio — os participantes são gravados por ele, e é honesto dizer
 * "ninguém registrado" em vez de inventar a partir de quem abriu a sala.
 */
export async function PatientCallsPanel({
  clinicId,
  patientId,
}: {
  clinicId: string
  patientId: string
}) {
  const supabase = await createClient()
  const calls = await listCallsForPatient(supabase, clinicId, patientId)

  const totalMinutos = calls.reduce(
    (soma, c) => soma + (c.durationSeconds ? Math.ceil(c.durationSeconds / 60) : 0),
    0
  )

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Video className="size-4" aria-hidden />
          Teleconsultas
        </h3>
        {calls.length > 0 && (
          <p className="text-[0.78rem] text-muted-foreground">
            {calls.length} chamada(s) ·{" "}
            <span className="font-medium tabular-nums">{totalMinutos} min</span> no total
          </p>
        )}
      </div>

      {calls.length === 0 ? (
        <EmptyState
          title="Nenhuma teleconsulta"
          description="As chamadas por vídeo deste paciente aparecem aqui."
          showMascot={false}
        />
      ) : (
        <ul className="grid gap-1.5">
          {calls.map((call) => (
            <CallRow key={call.id} call={call} />
          ))}
        </ul>
      )}
    </div>
  )
}
