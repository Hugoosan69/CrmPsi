"use client"

import { useActionState, useState, useTransition } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusDot } from "@/components/shared/status-dot"
import { useCloseOnSuccess } from "@/hooks/use-close-on-success"
import { ROOM_KINDS, roomKindLabel, type Room } from "@/config/agenda"
import {
  createRoomAction,
  setRoomActiveAction,
  type AvailabilityActionState,
} from "../actions/availability.actions"

const initialState: AvailabilityActionState = {}

export function RoomsPanel({ rooms }: { rooms: Room[] }) {
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Salas são recursos com agenda própria: dois profissionais não podem ocupar a mesma
          sala no mesmo horário.
        </p>
        <CreateRoomDialog />
      </div>

      {rooms.length === 0 ? (
        <EmptyState
          title="Nenhuma sala cadastrada"
          description="Sem salas, a agenda controla apenas conflito de profissional. Cadastre as salas para evitar dois atendimentos no mesmo espaço."
          action={<CreateRoomDialog />}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sala</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Capacidade</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map((room) => (
                <TableRow key={room.id}>
                  <TableCell className="font-medium">
                    {room.name}
                    {room.notes ? (
                      <span className="block text-xs text-muted-foreground">{room.notes}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{roomKindLabel(room.kind)}</TableCell>
                  <TableCell className="text-right tabular-nums">{room.capacity}</TableCell>
                  <TableCell>
                    <StatusDot
                      tone={room.active ? "success" : "neutral"}
                      label={room.active ? "Ativa" : "Inativa"}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <ToggleRoom room={room} />
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

function ToggleRoom({ room }: { room: Room }) {
  const [isPending, start] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        start(async () => {
          try {
            await setRoomActiveAction(room.id, !room.active)
            toast.success(room.active ? "Sala desativada." : "Sala reativada.")
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível alterar a sala.")
          }
        })
      }
    >
      {room.active ? "Desativar" : "Reativar"}
    </Button>
  )
}

function CreateRoomDialog() {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(createRoomAction, initialState)

  useCloseOnSuccess(state, Boolean(state.success), () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Nova sala</Button>} />
      <DialogContent className="max-w-md">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Nova sala</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3.5 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="room-name">Nome</Label>
              <Input id="room-name" name="name" placeholder="Consultório 1" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="room-kind">Tipo</Label>
              <Select name="kind" defaultValue="consultorio">
                <SelectTrigger id="room-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROOM_KINDS.map((kind) => (
                    <SelectItem key={kind.value} value={kind.value}>
                      {kind.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="room-capacity">Capacidade</Label>
              <Input
                id="room-capacity"
                name="capacity"
                type="number"
                min={1}
                defaultValue={1}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="room-notes">Observações</Label>
              <Textarea id="room-notes" name="notes" rows={2} />
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
