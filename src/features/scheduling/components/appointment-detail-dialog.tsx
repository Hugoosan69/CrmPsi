"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import {
  AlertTriangle,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  Layers,
  LogIn,
  Trash2,
  UserX,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { StatusDot } from "@/components/shared/status-dot"
import { useCloseOnSuccess } from "@/hooks/use-close-on-success"
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_TONES } from "@/config/agenda"
import type { AppointmentView } from "@/services/scheduling.service"
import { formatDateTime, formatTime } from "@/utils/datetime"
import type { ProcedureOption, ProfessionalOption } from "@/types/options"
import {
  cancelAppointmentAction,
  checkInAppointmentAction,
  completeAppointmentAction,
  confirmAppointmentAction,
  deleteAppointmentAction,
  markNoShowAppointmentAction,
  rescheduleAppointmentAction,
  type AppointmentActionState,
  type CheckInState,
} from "../actions/appointment.actions"
import { AppointmentFormFields } from "./appointment-form-fields"
import { LinkAppointmentPackageFields } from "@/features/packages/components/link-appointment-package-fields"
import {
  linkAppointmentToPackageAction,
  type PackageActionState,
} from "@/features/packages/actions/package.actions"

type Mode = "view" | "reschedule" | "cancel" | "checkin" | "delete" | "no_show" | "link_package"

const emptyAppointmentState: AppointmentActionState = {}
const emptyCheckInState: CheckInState = {}
const emptyPackageState: PackageActionState = {}

/**
 * One modal for everything you can do to a booking, opened by clicking it in the calendar.
 *
 * Modes rather than nested dialogs: stacking a Dialog inside a Dialog traps focus in the
 * wrong layer and leaves the operator unsure which Escape closes what. The body swaps, the
 * modal stays one modal.
 */
export function AppointmentDetailDialog({
  appointment,
  professionals,
  procedures,
  rooms = [],
  canManage,
  canCheckIn,
  open,
  onOpenChange,
}: {
  appointment: AppointmentView | null
  professionals: ProfessionalOption[]
  procedures: ProcedureOption[]
  rooms?: { id: string; name: string }[]
  canManage: boolean
  canCheckIn: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [mode, setMode] = useState<Mode>("view")

  function close() {
    onOpenChange(false)
    // Reset after the close animation so the body does not flicker back to "view".
    setTimeout(() => setMode("view"), 150)
  }

  if (!appointment) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
        else onOpenChange(true)
      }}
    >
      <DialogContent className={mode === "reschedule" ? "max-w-lg" : "max-w-md"}>
        {mode === "view" && (
          <ViewMode
            appointment={appointment}
            procedures={procedures}
            rooms={rooms}
            canManage={canManage}
            canCheckIn={canCheckIn}
            onMode={setMode}
            onClose={close}
          />
        )}

        {mode === "reschedule" && (
          <RescheduleMode
            appointment={appointment}
            professionals={professionals}
            procedures={procedures}
            rooms={rooms}
            onBack={() => setMode("view")}
            onDone={close}
          />
        )}

        {mode === "cancel" && (
          <CancelMode
            appointmentId={appointment.id}
            onBack={() => setMode("view")}
            onDone={close}
          />
        )}

        {mode === "checkin" && (
          <CheckInMode
            appointment={appointment}
            procedurePrice={
              appointment.procedure_id
                ? procedures.find((p) => p.id === appointment.procedure_id)?.price ?? null
                : null
            }
            onBack={() => setMode("view")}
            onDone={close}
          />
        )}

        {mode === "delete" && (
          <DeleteMode
            appointmentId={appointment.id}
            onBack={() => setMode("view")}
            onDone={close}
          />
        )}

        {mode === "no_show" && (
          <NoShowMode
            appointmentId={appointment.id}
            hasPackageSession={!!appointment.packageSessionLabel}
            onBack={() => setMode("view")}
            onDone={close}
          />
        )}

        {mode === "link_package" && (
          <LinkPackageMode
            appointmentId={appointment.id}
            onBack={() => setMode("view")}
            onDone={close}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ViewMode({
  appointment,
  rooms,
  canManage,
  canCheckIn,
  onMode,
  onClose,
}: {
  appointment: AppointmentView
  procedures: ProcedureOption[]
  rooms: { id: string; name: string }[]
  canManage: boolean
  canCheckIn: boolean
  onMode: (mode: Mode) => void
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()

  const roomName = appointment.room_id
    ? rooms.find((r) => r.id === appointment.room_id)?.name ?? null
    : null

  const endTime = new Date(
    new Date(appointment.scheduled_at).getTime() + appointment.duration_minutes * 60_000
  ).toISOString()

  const isOpen = appointment.status === "scheduled" || appointment.status === "confirmed"

  return (
    <>
      <DialogHeader>
        <DialogTitle>{appointment.patientName}</DialogTitle>
        <DialogDescription>
          {formatDateTime(appointment.scheduled_at)} – {formatTime(endTime)} ·{" "}
          {appointment.duration_minutes} min
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
        <Row label="Situação" value={
          <StatusDot
            tone={APPOINTMENT_STATUS_TONES[appointment.status]}
            label={APPOINTMENT_STATUS_LABELS[appointment.status]}
          />
        } />
        <Row label="Profissional" value={appointment.professionalName} />
        <Row label="Procedimento" value={appointment.procedureName ?? "Não informado"} />
        {appointment.packageSessionLabel && (
          <Row
            label="Pacote"
            value={
              <span className={appointment.packageSessionIsLast ? "font-medium text-amber-600" : ""}>
                {appointment.packageName ? `${appointment.packageName} · ` : ""}
                {appointment.packageSessionLabel}
                {appointment.packageSessionIsLast ? " · última sessão" : ""}
              </span>
            }
          />
        )}
        {roomName && <Row label="Sala" value={roomName} />}
        <Row
          label="Check-in"
          value={
            appointment.checked_in_at ? formatDateTime(appointment.checked_in_at) : "Não realizado"
          }
        />
        {appointment.cancelled_reason && (
          <Row label="Motivo do cancelamento" value={appointment.cancelled_reason} />
        )}
      </div>

      {appointment.notes && (
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Observações</p>
          <p className="text-sm whitespace-pre-wrap">{appointment.notes}</p>
        </div>
      )}

      {!isOpen && (
        <p className="text-sm text-muted-foreground">
          Este agendamento está {APPOINTMENT_STATUS_LABELS[appointment.status].toLowerCase()} — não
          há ações disponíveis.
        </p>
      )}

      {/* Vincular a um pacote não depende do agendamento estar aberto: a recepção também
          precisa acertar retroativamente uma consulta já concluída de paciente de pacote. */}
      {canManage && !appointment.packageSessionLabel && (
        <div className="grid gap-2">
          <Button variant="outline" onClick={() => onMode("link_package")}>
            <Layers className="size-4" />
            Vincular a um pacote
          </Button>
        </div>
      )}

      {isOpen && (
        <div className="grid gap-2">
          {canManage && appointment.status === "scheduled" && (
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await confirmAppointmentAction(appointment.id)
                  toast.success("Agendamento confirmado.")
                  onClose()
                })
              }
            >
              <CheckCircle2 className="size-4" />
              Confirmar presença
            </Button>
          )}

          {canCheckIn && !appointment.checked_in_at && (
            <Button onClick={() => onMode("checkin")}>
              <LogIn className="size-4" />
              Fazer check-in
            </Button>
          )}

          {/* Fechamento manual: sem isto, quem atende fora da fila deixa o agendamento
              "confirmado" para sempre — e a sessão do pacote nunca é debitada. */}
          {canManage && (
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await completeAppointmentAction(appointment.id)
                  toast.success("Atendimento marcado como concluído.")
                  onClose()
                })
              }
            >
              <CheckCheck className="size-4" />
              Marcar como atendido
            </Button>
          )}

          {canManage && (
            <>
              <Button variant="outline" onClick={() => onMode("reschedule")}>
                <CalendarClock className="size-4" />
                Remarcar
              </Button>

              <Button variant="outline" onClick={() => onMode("no_show")}>
                <UserX className="size-4" />
                Marcar como não compareceu
              </Button>

              <Button variant="outline" onClick={() => onMode("cancel")}>
                <XCircle className="size-4" />
                Cancelar agendamento
              </Button>

              <Button
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onMode("delete")}
              >
                <Trash2 className="size-4" />
                Excluir
              </Button>
            </>
          )}
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Fechar
        </Button>
      </DialogFooter>
    </>
  )
}

function RescheduleMode({
  appointment,
  professionals,
  procedures,
  rooms,
  onBack,
  onDone,
}: {
  appointment: AppointmentView
  professionals: ProfessionalOption[]
  procedures: ProcedureOption[]
  rooms: { id: string; name: string }[]
  onBack: () => void
  onDone: () => void
}) {
  const action = rescheduleAppointmentAction.bind(null, appointment.id)
  const [state, formAction, isPending] = useActionState(action, emptyAppointmentState)

  useCloseOnSuccess(state, Boolean(state.success), onDone)

  return (
    <form action={formAction}>
      <DialogHeader>
        <DialogTitle>Remarcar</DialogTitle>
        <DialogDescription>
          O horário é validado contra a agenda do profissional, bloqueios e ocupação da sala.
        </DialogDescription>
      </DialogHeader>
      <div className="py-4">
        <AppointmentFormFields
          appointment={appointment}
          patientDefault={{ id: appointment.patient_id, label: appointment.patientName }}
          professionals={professionals}
          procedures={procedures}
          rooms={rooms}
        />
      </div>
      {state.error && (
        <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar novo horário"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function CancelMode({
  appointmentId,
  onBack,
  onDone,
}: {
  appointmentId: string
  onBack: () => void
  onDone: () => void
}) {
  const [reason, setReason] = useState("")
  const [isPending, startTransition] = useTransition()

  return (
    <>
      <DialogHeader>
        <DialogTitle>Cancelar agendamento</DialogTitle>
        <DialogDescription>
          O registro é mantido como cancelado e o horário volta a ficar livre na agenda.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5 py-4">
        <Label htmlFor="cancel-reason">Motivo (opcional)</Label>
        <Textarea
          id="cancel-reason"
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <Button
          variant="destructive"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await cancelAppointmentAction(appointmentId, reason)
              toast.success("Agendamento cancelado.")
              onDone()
            })
          }
        >
          {isPending ? "Cancelando..." : "Confirmar cancelamento"}
        </Button>
      </DialogFooter>
    </>
  )
}

function LinkPackageMode({
  appointmentId,
  onBack,
  onDone,
}: {
  appointmentId: string
  onBack: () => void
  onDone: () => void
}) {
  const action = linkAppointmentToPackageAction.bind(null, appointmentId)
  const [state, formAction, isPending] = useActionState(action, emptyPackageState)

  // Effect, e não useCloseOnSuccess: aquele hook ajusta estado durante a renderização, o
  // que só é seguro quando o `close` mexe no estado do próprio componente (é o caso dos
  // diálogos que o usam). Aqui `onDone` fecha um diálogo que vive dois níveis acima, e
  // atualizar um ancestral durante o render do filho é exatamente o que o React proíbe —
  // apareceu como "Cannot update a component while rendering a different component".
  useEffect(() => {
    if (state.success) onDone()
  }, [state.success, onDone])

  return (
    <form action={formAction}>
      <DialogHeader>
        <DialogTitle>Vincular a um pacote</DialogTitle>
        <DialogDescription>
          A sessão passa a debitar do pacote: sem cobrança no check-in, e a contagem aparece
          no card da agenda e na ficha do paciente.
        </DialogDescription>
      </DialogHeader>

      <LinkAppointmentPackageFields appointmentId={appointmentId} />

      {state.error && (
        <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Vinculando..." : "Vincular"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function NoShowMode({
  appointmentId,
  hasPackageSession,
  onBack,
  onDone,
}: {
  appointmentId: string
  hasPackageSession: boolean
  onBack: () => void
  onDone: () => void
}) {
  const [isPending, startTransition] = useTransition()

  function submit(justified: boolean) {
    startTransition(async () => {
      await markNoShowAppointmentAction(appointmentId, justified)
      toast.success("Marcado como não compareceu.")
      onDone()
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Marcar como não compareceu</DialogTitle>
        {hasPackageSession && (
          <DialogDescription>
            Este agendamento usa uma sessão de pacote. Falta <strong>justificada</strong> libera a
            posição sem consumir o saldo; falta <strong>não justificada</strong> consome a sessão
            normalmente.
          </DialogDescription>
        )}
      </DialogHeader>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onBack} disabled={isPending}>
          Voltar
        </Button>
        <Button variant="outline" disabled={isPending} onClick={() => submit(true)}>
          Falta justificada
        </Button>
        <Button variant="destructive" disabled={isPending} onClick={() => submit(false)}>
          Falta não justificada
        </Button>
      </DialogFooter>
    </>
  )
}

function CheckInMode({
  appointment,
  procedurePrice,
  onBack,
  onDone,
}: {
  appointment: AppointmentView
  procedurePrice: number | null
  onBack: () => void
  onDone: () => void
}) {
  const action = checkInAppointmentAction.bind(null, appointment.id)
  const [state, formAction, isPending] = useActionState(action, emptyCheckInState)

  useCloseOnSuccess(state, Boolean(state.success), onDone)

  const hasPrice = procedurePrice !== null && procedurePrice > 0
  const isPackageSession = !!appointment.packageSessionLabel

  return (
    <form action={formAction}>
      <DialogHeader>
        <DialogTitle>Check-in{isPackageSession ? "" : " e cobrança"}</DialogTitle>
        <DialogDescription>
          {isPackageSession ? (
            <>
              Sessão de pacote ({appointment.packageSessionLabel}), já paga na venda — o paciente
              vai <strong>direto para a fila</strong>, sem cobrança nesta etapa.
            </>
          ) : (
            <>
              O paciente entra como <strong>pagamento pendente</strong> e só vai para a fila após o
              pagamento ser confirmado.
            </>
          )}
        </DialogDescription>
      </DialogHeader>
      {!isPackageSession && (
        <div className="grid gap-1.5 py-4">
          <Label htmlFor="checkin-amount">Valor a cobrar (R$)</Label>
          <Input
            id="checkin-amount"
            name="amount"
            type="number"
            min={0.01}
            step="0.01"
            defaultValue={hasPrice ? procedurePrice : undefined}
            required={!hasPrice}
            placeholder={hasPrice ? undefined : "Informe o valor"}
          />
          <p className="text-xs text-muted-foreground">
            {hasPrice
              ? "Preço do procedimento. Ajuste se necessário."
              : "Este procedimento não tem preço cadastrado — informe o valor."}
          </p>
        </div>
      )}
      {state.error && (
        <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Registrando..." : "Confirmar check-in"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function DeleteMode({
  appointmentId,
  onBack,
  onDone,
}: {
  appointmentId: string
  onBack: () => void
  onDone: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <>
      <DialogHeader>
        <DialogTitle>Excluir agendamento</DialogTitle>
        <DialogDescription>
          Isso apaga o registro definitivamente, sem deixar histórico na agenda.
        </DialogDescription>
      </DialogHeader>

      <div className="flex gap-2.5 rounded-lg border border-status-warning/40 bg-status-warning/5 p-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-warning" aria-hidden />
        <p className="text-sm text-muted-foreground">
          Use apenas para um agendamento criado por engano. Se o paciente faltou ou desmarcou,{" "}
          <strong className="font-medium text-foreground">Cancelar</strong> é o correto — preserva o
          histórico e a estatística de falta. A exclusão é recusada se já houver check-in, fila,
          cobrança ou prontuário vinculados.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <Button
          variant="destructive"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null)
              const result = await deleteAppointmentAction(appointmentId)
              if (result.error) {
                setError(result.error)
                return
              }
              toast.success("Agendamento excluído.")
              onDone()
            })
          }
        >
          {isPending ? "Excluindo..." : "Excluir definitivamente"}
        </Button>
      </DialogFooter>
    </>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}
