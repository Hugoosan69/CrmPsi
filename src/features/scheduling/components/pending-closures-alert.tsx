"use client"

import { useState, useTransition } from "react"
import { AlertTriangle, CheckCheck, UserX } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import type { AppointmentView } from "@/services/scheduling.service"
import { formatDateTime } from "@/utils/datetime"
import {
  completeAppointmentAction,
  markNoShowAppointmentAction,
} from "../actions/appointment.actions"

/**
 * Atendimentos cujo horário já passou e continuam "agendado"/"confirmado".
 *
 * Sem este aviso a agenda acumula consultas eternamente confirmadas: quem atende fora da
 * fila nunca chega ao `completed`, e aí ninguém sabe quem veio, a estatística de falta não
 * existe e a sessão do pacote nunca é debitada. Os dois botões resolvem no lugar, sem
 * precisar abrir cada agendamento.
 */
export function PendingClosuresAlert({ appointments }: { appointments: AppointmentView[] }) {
  const [expanded, setExpanded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [resolved, setResolved] = useState<string[]>([])

  const open = appointments.filter((a) => !resolved.includes(a.id))
  if (open.length === 0) return null

  function resolve(id: string, action: () => Promise<void>, message: string) {
    startTransition(async () => {
      await action()
      setResolved((prev) => [...prev, id])
      toast.success(message)
    })
  }

  return (
    <div className="rounded-xl border border-status-warning/40 bg-status-warning/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="size-4 shrink-0 text-status-warning" aria-hidden />
          <p className="text-sm">
            <strong className="font-medium">
              {open.length} {open.length === 1 ? "atendimento" : "atendimentos"}
            </strong>{" "}
            com horário já passado e ainda em aberto — marque se foi atendido ou se faltou.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Ocultar" : "Revisar"}
        </Button>
      </div>

      {expanded && (
        <ul className="mt-3 grid gap-2">
          {open.map((appointment) => (
            <li
              key={appointment.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{appointment.patientName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(appointment.scheduled_at)} · {appointment.professionalName}
                  {appointment.packageSessionLabel ? ` · ${appointment.packageSessionLabel}` : ""}
                </p>
              </div>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() =>
                    resolve(
                      appointment.id,
                      () => completeAppointmentAction(appointment.id),
                      "Marcado como atendido."
                    )
                  }
                >
                  <CheckCheck className="size-4" />
                  Atendido
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() =>
                    resolve(
                      appointment.id,
                      // Falta sem justificativa: consome a sessão do pacote, se houver.
                      () => markNoShowAppointmentAction(appointment.id, false),
                      "Marcado como não compareceu."
                    )
                  }
                >
                  <UserX className="size-4" />
                  Faltou
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
