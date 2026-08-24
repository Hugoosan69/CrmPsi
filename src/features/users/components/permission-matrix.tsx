"use client"

import { Fragment, useState, useTransition } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Database } from "@/types/supabase"
import { setRolePermissionAction } from "../actions/user.actions"

type Role = Pick<Database["public"]["Tables"]["roles"]["Row"], "id" | "name" | "is_system">
type Permission = Pick<Database["public"]["Tables"]["permissions"]["Row"], "id" | "slug" | "module" | "description">

function key(roleId: string, permissionId: string) {
  return `${roleId}:${permissionId}`
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

  function toggle(roleId: string, permissionId: string, next: boolean) {
    const k = key(roleId, permissionId)
    setGranted((prev) => {
      const copy = new Set(prev)
      if (next) copy.add(k)
      else copy.delete(k)
      return copy
    })
    startTransition(() => setRolePermissionAction(roleId, permissionId, next))
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Permissão</TableHead>
            {roles.map((role) => (
              <TableHead key={role.id} className="text-center">
                {role.name}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(permissionsByModule).map(([module, modulePermissions]) => (
            <Fragment key={module}>
              <TableRow className="bg-muted/50">
                <TableCell colSpan={roles.length + 1} className="text-xs font-medium uppercase text-muted-foreground">
                  {module}
                </TableCell>
              </TableRow>
              {modulePermissions.map((permission) => (
                <TableRow key={permission.id}>
                  <TableCell className="text-sm">{permission.description || permission.slug}</TableCell>
                  {roles.map((role) => (
                    <TableCell key={role.id} className="text-center">
                      <Checkbox
                        checked={granted.has(key(role.id, permission.id))}
                        onCheckedChange={(checked) => toggle(role.id, permission.id, checked === true)}
                        aria-label={`${permission.slug} para ${role.name}`}
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
  )
}
