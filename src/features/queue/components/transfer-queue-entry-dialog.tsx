"use client"

import { useState, useTransition } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { transferQueueEntryAction } from "../actions/queue.actions"
import type { ProfessionalOption } from "@/types/options"

export function TransferQueueEntryDialog({
  queueEntryId,
  fromProfessionalId,
  professionals,
}: {
  queueEntryId: string
  fromProfessionalId: string | null
  professionals: ProfessionalOption[]
}) {
  const [open, setOpen] = useState(false)
  const [toProfessionalId, setToProfessionalId] = useState("")
  const [reason, setReason] = useState("")
  const [isPending, startTransition] = useTransition()
  const queryClient = useQueryClient()

  const options = professionals.filter((p) => p.id !== fromProfessionalId)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm">Transferir</Button>} />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transferir atendimento</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-1.5">
            <Label htmlFor="to_professional">Novo profissional</Label>
            <Select value={toProfessionalId} onValueChange={(value) => setToProfessionalId(value ?? "")}>
              <SelectTrigger id="to_professional" className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {options.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="reason">Motivo</Label>
            <Textarea id="reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={isPending || !toProfessionalId}
            onClick={() =>
              startTransition(async () => {
                await transferQueueEntryAction(queueEntryId, fromProfessionalId, toProfessionalId, reason)
                queryClient.invalidateQueries({ queryKey: ["queue"] })
                setOpen(false)
              })
            }
          >
            {isPending ? "Transferindo..." : "Transferir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
