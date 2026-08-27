"use client"

import { Fragment, useState, useTransition } from "react"
import { Lock } from "lucide-react"
import { toast } from "sonner"

import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Database } from "@/types/supabase"
import { setRolePermissionAction } from "../actions/user.actions"

type Role = Pick<
  Database["public"]["Tables"]["roles"]["Row"],
  "id" | "name" | "is_system" | "clinic_id"
>
type Permission = Pick<
  Database["public"]["Tables"]["permissions"]["Row"],
  "id" | "slug" | "module" | "description"
>

function key(roleId: string, permissionId: string) {
  return `${roleId}:${permissionId}`
}

/**
 * A role with `clinic_id === null` is a system role shared by every tenant, so editing it
 * would change permissions for all of them. The server refuses those writes
 * (services/permissions.service.ts); this uses the *same* signal rather than `is_system`
 * so the UI can never offer a toggle the server will reject.
 */
function isShared(role: Role) {
  return role.clinic_id === null
}

export function PermissionMatrix({
  roles,
  permissions,
  initialGranted,
}: {
  roles: Role[]
  permissions: Permission[]
  initialGranted: Array<{ role_id: string; permission_id: string }>
}) {
  const [granted, setGranted] = useState(
    () => new Set(initialGranted.map((g) => key(g.role_id, g.permission_id)))
  )
  const [, startTransition] = useTransition()

  const permissionsByModule = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    ;(acc[p.module] ??= []).push(p)
    return acc
  }, {})

  const sharedRoles = roles.filter(isShared)

  function setLocal(k: string, value: boolean) {
    setGranted((prev) => {
      const copy = new Set(prev)
      if (value) copy.add(k)
      else copy.delete(k)
      return copy
    })
  }

  function toggle(roleId: string, permissionId: string, next: boolean) {
    const k = key(roleId, permissionId)
    setLocal(k, next)

    startTransition(async () => {
      try {
        await setRolePermissionAction(roleId, permissionId, next)
      } catch (err) {
        // Without this the checkbox keeps the optimistic value and the matrix lies about
        // what the server actually holds.
        setLocal(k, !next)
        toast.error(
          err instanceof Error ? err.message : "Não foi possível alterar esta permissão."
        )
      }
    })
  }

  return (
    <div className="grid gap-3">
      {sharedRoles.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {sharedRoles.length === roles.length ? "Todos os papéis abaixo são" : "Alguns papéis são"}{" "}
          padrões do sistema, compartilhados por todas as clínicas — suas permissões são fixas.
          Para personalizar, crie um papel próprio da clínica.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Permissão</TableHead>
              {roles.map((role) => (
                <TableHead key={role.id} className="text-center">
                  <span className="inline-flex items-center gap-1.5">
                    {role.name}
                    {isShared(role) && (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <span
                              className="text-muted-foreground"
                              aria-label="Papel do sistema, somente leitura"
                            >
                              <Lock className="size-3" />
                            </span>
                          }
                        />
                        <TooltipContent>
                          Papel do sistema — compartilhado por todas as clínicas
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(permissionsByModule).map(([module, modulePermissions]) => (
              <Fragment key={module}>
                <TableRow className="bg-muted/50">
                  <TableCell
                    colSpan={roles.length + 1}
                    className="text-xs font-medium text-muted-foreground uppercase"
                  >
                    {module}
                  </TableCell>
                </TableRow>
                {modulePermissions.map((permission) => (
                  <TableRow key={permission.id}>
                    <TableCell className="text-sm">
                      {permission.description || permission.slug}
                    </TableCell>
                    {roles.map((role) => (
                      <TableCell key={role.id} className="text-center">
                        <Checkbox
                          checked={granted.has(key(role.id, permission.id))}
                          disabled={isShared(role)}
                          onCheckedChange={(checked) =>
                            toggle(role.id, permission.id, checked === true)
                          }
                          aria-label={`${permission.slug} para ${role.name}${
                            isShared(role) ? " (papel do sistema, somente leitura)" : ""
                          }`}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
