"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { requireMembership } from "@/lib/auth/session"
import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/notifications.service"
import { countUnreadMessages } from "@/services/internal-chat.service"

/**
 * No permission slug here on purpose: a notification is addressed to one person and RLS
 * scopes every read and write to `user_id = auth.uid()` (database/migrations/004). What
 * needs proving is an active membership, nothing more.
 *
 * Both header badges come from this one call. The bell and the messages icon are mounted on
 * every screen, so two independent polling hooks would double a cost that is already paid
 * on every page in the product.
 */
export async function notificationInboxAction() {
  const membership = await requireMembership()
  const supabase = await createClient()

  const [items, unread, unreadMessages] = await Promise.all([
    listNotifications(supabase, { limit: 25 }),
    countUnreadNotifications(supabase),
    countUnreadMessages(supabase, membership.userId).catch(() => 0),
  ])

  return { items, unread, unreadMessages }
}

export async function markNotificationReadAction(notificationId: string) {
  await requireMembership()
  const supabase = await createClient()
  await markNotificationRead(supabase, notificationId)
  revalidatePath("/", "layout")
}

export async function markAllNotificationsReadAction() {
  await requireMembership()
  const supabase = await createClient()
  await markAllNotificationsRead(supabase)
  revalidatePath("/", "layout")
}
