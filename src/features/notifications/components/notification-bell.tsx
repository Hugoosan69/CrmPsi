"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Bell,
  CalendarDays,
  Info,
  ListOrdered,
  MessageSquare,
  Wallet,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/utils/datetime"
import type { NotificationKind } from "@/types/supabase"
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  notificationInboxAction,
} from "../actions/notification.actions"

const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  system: Info,
  chat: MessageSquare,
  queue: ListOrdered,
  agenda: CalendarDays,
  financial: Wallet,
}

const KIND_CLASS: Record<NotificationKind, string> = {
  system: "bg-muted text-muted-foreground",
  chat: "bg-status-info/12 text-status-info",
  queue: "bg-status-warning/14 text-status-warning",
  agenda: "bg-accent text-accent-foreground",
  financial: "bg-status-success/12 text-status-success",
}

/**
 * Polling rather than Realtime as the baseline: migration 004 does add these tables to the
 * realtime publication, but a clinic whose project has replication disabled must still get
 * its notifications. 45 s is deliberate — a notification is not a live queue, and this
 * component is mounted on every single screen.
 */
const POLL_MS = 45_000

export function NotificationBell() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [, startTransition] = useTransition()

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["notifications", "inbox"],
    queryFn: () => notificationInboxAction(),
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  })

  const items = data?.items ?? []
  const unread = data?.unread ?? 0

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["notifications", "inbox"] })
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative"
            aria-label={
              unread > 0 ? `Notificações — ${unread} não lidas` : "Notificações"
            }
          >
            <Bell className="size-[1.05rem]" />
            {unread > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.62rem] font-semibold text-white tabular-nums"
                aria-hidden
              >
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Button>
        }
      />
      <PopoverContent className="w-[21rem] p-0" align="end">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <p className="text-sm font-medium">Notificações</p>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[0.75rem]"
              onClick={() =>
                startTransition(async () => {
                  await markAllNotificationsReadAction()
                  invalidate()
                })
              }
            >
              Marcar todas como lidas
            </Button>
          )}
        </div>

        {isPending ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : isError ? (
          <div className="px-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">Não foi possível carregar.</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : items.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            Nada por aqui. Avisos da fila, agenda, financeiro e mensagens internas aparecem
            nesta lista.
          </p>
        ) : (
          <ScrollArea className="max-h-[24rem]">
            <ul className="divide-y divide-border">
              {items.map((item) => {
                const Icon = KIND_ICON[item.kind] ?? Info
                const isUnread = !item.read_at

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-accent/50",
                        isUnread && "bg-accent/25"
                      )}
                      onClick={() =>
                        startTransition(async () => {
                          if (isUnread) await markNotificationReadAction(item.id)
                          invalidate()
                          if (item.href) router.push(item.href)
                        })
                      }
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
                          KIND_CLASS[item.kind] ?? KIND_CLASS.system
                        )}
                        aria-hidden
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span
                            className={cn(
                              "truncate text-[0.82rem]",
                              isUnread ? "font-medium" : "font-normal"
                            )}
                          >
                            {item.title}
                          </span>
                          <span className="shrink-0 text-[0.68rem] text-muted-foreground tabular-nums">
                            {formatRelativeTime(item.created_at)}
                          </span>
                        </span>
                        {item.body && (
                          <span className="mt-0.5 line-clamp-2 block text-[0.75rem] text-muted-foreground">
                            {item.body}
                          </span>
                        )}
                      </span>
                      {isUnread && (
                        <span
                          className="mt-2 size-1.5 shrink-0 rounded-full bg-status-info"
                          aria-label="Não lida"
                        />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  )
}
