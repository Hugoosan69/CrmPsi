"use client"

import { useTransition } from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Database } from "@/types/supabase"
import { updateMembershipRoleAction } from "../actions/user.actions"

type Role = Pick<Database["public"]["Tables"]["roles"]["Row"], "id" | "name">

export function MemberRoleSelect({
  membershipId,
  roleId,
  roles,
}: {
  membershipId: string
  roleId: string
  roles: Role[]
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <Select
      defaultValue={roleId}
      disabled={isPending}
      onValueChange={(value) => {
        startTransition(() => updateMembershipRoleAction(membershipId, value as string))
      }}
    >
      <SelectTrigger size="sm" className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roles.map((role) => (
          <SelectItem key={role.id} value={role.id}>
            {role.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
