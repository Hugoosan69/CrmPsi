"use client"

import { useState, useTransition } from "react"
import { UserPlus, UserMinus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  linkProfessionalAction,
  unlinkProfessionalAction,
} from "@/features/patients/actions/professional-links.actions"

type Link = {
  id: string
  professional_id: string
  source: string
  created_at: string
}

type Professional = {
  id: string
  full_name: string
}

export function PatientProfessionalLinks({
  patientId,
  links,
  professionals,
}: {
  patientId: string
  links: Link[]
  professionals: Professional[]
}) {
  const [selectedProfId, setSelectedProfId] = useState("")
  const [isPending, startTransition] = useTransition()

  const linkedProfIds = new Set(links.map((l) => l.professional_id))
  const availableProfessionals = professionals.filter((p) => !linkedProfIds.has(p.id))

  const profMap = new Map(professionals.map((p) => [p.id, p.full_name]))

  function handleLink() {
    if (!selectedProfId) return
    startTransition(async () => {
      await linkProfessionalAction(patientId, selectedProfId)
      setSelectedProfId("")
    })
  }

  function handleUnlink(professionalId: string) {
    startTransition(async () => {
      await unlinkProfessionalAction(patientId, professionalId)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profissionais vinculados</CardTitle>
        <CardDescription>
          Profissionais que atendem este paciente. Vínculos são criados
          automaticamente ao agendar uma consulta, mas podem ser gerenciados
          manualmente aqui.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum profissional vinculado a este paciente.
          </p>
        ) : (
          <div className="grid gap-2">
            {links.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {profMap.get(link.professional_id) ?? "Profissional removido"}
                  </span>
                  <Badge variant="outline" className="text-[0.7rem]">
                    {link.source === "appointment" ? "Agendamento" : "Manual"}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:text-destructive"
                  disabled={isPending}
                  onClick={() => handleUnlink(link.professional_id)}
                  title="Desvincular profissional"
                >
                  <UserMinus className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {availableProfessionals.length > 0 && (
          <div className="flex items-end gap-2">
            <div className="grid flex-1 gap-1.5">
              <Select value={selectedProfId} onValueChange={(v) => setSelectedProfId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar profissional..." />
                </SelectTrigger>
                <SelectContent>
                  {availableProfessionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              disabled={!selectedProfId || isPending}
              onClick={handleLink}
            >
              <UserPlus className="mr-1.5 size-4" />
              Vincular
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
