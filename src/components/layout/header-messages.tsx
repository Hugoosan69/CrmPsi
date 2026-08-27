"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { MessagesSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { notificationInboxAction } from "@/features/notifications/actions/notification.actions"

/**
 * Shares the notification bell's query key, so the unread badge costs no extra request —
 * `notificationInboxAction` returns both counts and TanStack Query dedupes the two
 * subscribers into one poll.
 */
export function HeaderMessages() {
  const pathname = usePathname()
  const isActive = pathname.startsWith("/mensagens")

  const { data } = useQuery({
    queryKey: ["notifications", "inbox"],
    queryFn: () => notificationInboxAction(),
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
  })

  const unread = data?.unreadMessages ?? 0

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            nativeButton={false}
            variant="ghost"
            size="icon-sm"
            className={cn("relative", isActive && "bg-accent text-accent-foreground")}
            render={
              <Link
                href="/mensagens"
                aria-label={
                  unread > 0
                    ? `Mensagens internas — ${unread} não lidas`
                    : "Mensagens internas"
                }
              >
                <MessagesSquare className="size-[1.05rem]" />
                {unread > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-status-info px-1 text-[0.62rem] font-semibold text-white tabular-nums"
                    aria-hidden
                  >
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            }
          />
        }
      />
      <TooltipContent>Mensagens internas</TooltipContent>
    </Tooltip>
  )
}
