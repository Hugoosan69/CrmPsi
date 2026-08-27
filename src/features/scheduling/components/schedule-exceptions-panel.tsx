"use client"

import { useActionState, useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusDot } from "@/components/shared/status-dot"
import { useCloseOnSuccess } from "@/hooks/use-close-on-success"
import { formatDateTime } from "@/utils/datetime"
import type { ScheduleException } from "@/config/agenda"
import {
  createScheduleExceptionAction,
  deleteScheduleExceptionAction,
  type AvailabilityActionState,
} from "../actions/availability.actions"

type ProfessionalOption = { id: string; full_name: string }

const initialState: AvailabilityActionState = {}

export function ScheduleExceptionsPanel({
  professionals,
  exceptions,
}: {
  professionals: ProfessionalOption[]
  exceptions: ScheduleException[]
}) {
  const nameById = new Map(professionals.map((p) => [p.id, p.full_name]))

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Bloqueios removem disponibilidade (férias, feriado, ausência). Plantões extras
          liberam atendimento fora do horário semanal. Sem profissional selecionado, vale
          para toda a clínica.
        </p>
        <CreateExceptionDialog professionals={professionals} />
      </div>

      {exceptions.length === 0 ? (
        <EmptyState
          title="Nenhum bloqueio registrado"
          description="Feriados e férias não são deduzidos automaticamente — registre-os aqui para que a agenda pare de oferecer esses horários."
          action={<CreateExceptionDialog professionals={professionals} />}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Profissional</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exceptions.map((exception) => (
                <TableRow key={exception.id}>
                  <TableCell>
                    <StatusDot
                      tone={exception.kind === "block" ? "warning" : "info"}
                      label={exception.kind === "block" ? "Bloqueio" : "Plantão extra"}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {exception.professional_id
                      ? nameById.get(exception.professional_id) ?? "—"
                      : "Toda a clínica"}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatDateTime(exception.starts_at)}</TableCell>
                  <TableCell className="tabular-nums">{formatDateTime(exception.ends_at)}</TableCell>
                  <TableCell className="text-muted-foreground">{exception.reason ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <DeleteException id={exception.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function DeleteException({ id }: { id: string }) {
  const [isPending, start] = useTransition()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Remover bloqueio"
      disabled={isPending}
      onClick={() =>
        start(async () => {
          try {
            await deleteScheduleExceptionAction(id)
            toast.success("Bloqueio removido.")
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível remover o bloqueio.")
          }
        })
      }
    >
      <Trash2 className="size-4" />
    </Button>
  )
}

function CreateExceptionDialog({ professionals }: { professionals: ProfessionalOption[] }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(createScheduleExceptionAction, initialState)

  useCloseOnSuccess(state, Boolean(state.success), () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Novo bloqueio</Button>} />
      <DialogContent className="max-w-md">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Novo bloqueio ou plantão</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3.5 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="exception-kind">Tipo</Label>
              <Select name="kind" defaultValue="block">
                <SelectTrigger id="exception-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="block">Bloqueio — remove disponibilidade</SelectItem>
                  <SelectItem value="extra">Plantão extra — libera fora do horário</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="exception-professional">Profissional</Label>
              <Select name="professional_id" defaultValue="">
                <SelectTrigger id="exception-professional">
                  <SelectValue placeholder="Toda a clínica" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Toda a clínica (feriado)</SelectItem>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="exception-start">Início</Label>
              <Input id="exception-start" name="starts_at" type="datetime-local" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="exception-end">Fim</Label>
              <Input id="exception-end" name="ends_at" type="datetime-local" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="exception-reason">Motivo</Label>
              <Input id="exception-reason" name="reason" placeholder="Férias, feriado, congresso..." />
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
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
