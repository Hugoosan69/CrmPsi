"use client"

import Link from "next/link"
import { LogOut, UserCog } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut } from "@/app/(auth)/login/actions"
import { UserAvatar } from "@/components/shared/user-avatar"

/**
 * Identity and account actions live in the header, which is the one piece of chrome present
 * at every breakpoint and with the sidebar collapsed. The sidebar footer keeps showing who
 * is signed in, but no longer duplicates sign-out.
 */
export function UserMenu({
  fullName,
  avatarUrl,
  roleName,
  clinicName,
}: {
  fullName: string
  avatarUrl?: string | null
  roleName: string
  clinicName: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-9 gap-2 px-1.5"
            aria-label={`Conta de ${fullName}`}
          >
            <UserAvatar
              src={avatarUrl}
              name={fullName}
              className="size-7"
              textClassName="text-[0.68rem]"
            />
            <span className="hidden min-w-0 text-left leading-tight lg:block">
              <span className="block truncate text-[0.78rem] font-medium">
                {fullName.split(" ")[0]}
              </span>
              <span className="block truncate text-[0.66rem] text-muted-foreground">
                {roleName}
              </span>
            </span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-60">
        <div className="px-2 py-1.5">
          <p className="truncate text-[0.82rem] font-medium">{fullName}</p>
          <p className="truncate text-[0.72rem] text-muted-foreground">
            {roleName} · {clinicName}
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/perfil" />}>
          <UserCog className="size-4" />
          Editar perfil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* A form post, not a link: signing out is a mutation and must not be prefetched
            or triggered by a crawler following an href. */}
        <form action={signOut}>
          <DropdownMenuItem
            render={
              <button type="submit" className="w-full">
                <LogOut className="size-4" />
                Sair
              </button>
            }
          />
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
