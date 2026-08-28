"use client"

import { useActionState, useState } from "react"
import { Pencil, Plus } from "lucide-react"

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusDot } from "@/components/shared/status-dot"
import { ToggleActiveButton } from "@/components/shared/toggle-active-button"
import { useCloseOnSuccess } from "@/hooks/use-close-on-success"
import type { Specialty } from "@/services/professionals.service"
import {
  createSpecialtyAction,
  setSpecialtyActiveAction,
  updateSpecialtyAction,
  type SpecialtyActionState,
} from "../actions/specialty.actions"

const initialState: SpecialtyActionState = {}

export function SpecialtiesPanel({ specialties }: { specialties: Specialty[] }) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          As especialidades alimentam o cadastro de profissionais. Desativar uma esconde-a de
          novos cadastros sem alterar quem já está vinculado a ela.
        </p>
        <SpecialtyDialog />
      </div>

      {specialties.length === 0 ? (
        <EmptyState
          title="Nenhuma especialidade cadastrada"
          description="Cadastre as especialidades atendidas pela clínica para poder vinculá-las aos profissionais."
          action={<SpecialtyDialog />}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Especialidade</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-1" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {specialties.map((specialty) => (
                <TableRow key={specialty.id}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      <StatusDot
                        tone={specialty.active ? "success" : "neutral"}
                        label={specialty.active ? "Ativa" : "Inativa"}
                      />
                      {specialty.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {specialty.description || "—"}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <SpecialtyDialog specialty={specialty} />
                    <ToggleActiveButton
                      active={specialty.active}
                      confirmTitle={
                        specialty.active ? "Desativar especialidade?" : "Ativar especialidade?"
                      }
                      confirmDescription={
                        specialty.active
                          ? "Ela deixa de aparecer no cadastro de profissionais. Quem já está vinculado a ela não muda."
                          : "Ela volta a aparecer no cadastro de profissionais."
                      }
                      action={async () => {
                        await setSpecialtyActiveAction(specialty.id, !specialty.active)
                      }}
                    />
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

/**
 * Um diálogo só para criar e editar: os campos são os mesmos e as duas ações compartilham o
 * mesmo schema de validação, então duas telas separadas só criariam a chance de divergirem.
 */
function SpecialtyDialog({ specialty }: { specialty?: Specialty }) {
  const isEdit = Boolean(specialty)
  const [open, setOpen] = useState(false)

  const [state, formAction, isPending] = useActionState(
    isEdit ? updateSpecialtyAction.bind(null, specialty!.id) : createSpecialtyAction,
    initialState
  )
  useCloseOnSuccess(state, Boolean(state.success), () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          isEdit ? (
            <Button variant="ghost" size="sm" aria-label={`Editar ${specialty!.name}`}>
              <Pencil className="size-3.5" />
            </Button>
          ) : (
            <Button size="sm">
              <Plus className="size-4" />
              Nova especialidade
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar especialidade" : "Nova especialidade"}</DialogTitle>
        </DialogHeader>
        {/* key força o form a remontar após um sucesso, limpando os campos digitados —
            sem isso o diálogo reabriria com o texto da última criação. */}
        <form action={formAction} className="grid gap-4" key={state.success ? "done" : "form"}>
          <div className="grid gap-1.5">
            <Label htmlFor={`specialty-name-${specialty?.id ?? "new"}`}>Nome</Label>
            <Input
              id={`specialty-name-${specialty?.id ?? "new"}`}
              name="name"
              defaultValue={specialty?.name ?? ""}
              placeholder="Fisioterapia"
              required
              autoFocus
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`specialty-desc-${specialty?.id ?? "new"}`}>
              Descrição <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id={`specialty-desc-${specialty?.id ?? "new"}`}
              name="description"
              defaultValue={specialty?.description ?? ""}
              rows={2}
              placeholder="Reabilitação motora e prevenção de lesões"
            />
          </div>

          {state.error && (
            <p
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {state.error}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : isEdit ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
