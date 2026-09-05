"use client"

import { useActionState, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useCloseOnSuccess } from "@/hooks/use-close-on-success"
import type { SessionPackageView } from "@/services/packages.service"
import { updateSessionPackageAction, type PackageActionState } from "../actions/package.actions"
import { PackageFormFields } from "./package-form-fields"

const initialState: PackageActionState = {}

export function EditPackageDialog({
  sessionPackage,
  specialties,
}: {
  sessionPackage: SessionPackageView
  specialties: { id: string; name: string }[]
}) {
  const [open, setOpen] = useState(false)
  const action = updateSessionPackageAction.bind(null, sessionPackage.id)
  const [state, formAction, isPending] = useActionState(action, initialState)

  useCloseOnSuccess(state, Boolean(state.success), () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm">Editar</Button>} />
      <DialogContent className="max-w-lg">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Editar pacote</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <PackageFormFields sessionPackage={sessionPackage} specialties={specialties} />
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
