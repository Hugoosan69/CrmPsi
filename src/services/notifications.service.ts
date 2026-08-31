import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, NotificationKind } from "@/types/supabase"
import { createAdminClient } from "@/lib/supabase/admin"
import { pendingMigrationFor } from "@/lib/db-errors"

type DB = SupabaseClient<Database>

export type Notification = Database["public"]["Tables"]["notifications"]["Row"]

export type NotifyInput = {
  clinicId: string
  /** One row per recipient — fan-out on write, so the inbox is a plain indexed read. */
  userIds: string[]
  kind: NotificationKind
  title: string
  body?: string | null
  href?: string | null
  entityType?: string | null
  entityId?: string | null
  /** Usually the actor: nobody needs telling about their own action. */
  exceptUserId?: string | null
}

/**
 * Writes notifications with the service-role client, because `notifications` has no client
 * insert policy (database/migrations/004) — that is what makes a notification trustworthy:
 * it can only have come from the server.
 *
 * Never throws. A notification is a side effect of an operation that already succeeded;
 * failing to deliver one must not roll back a check-in or a transfer. Failures are logged
 * and swallowed, including "migration 004 not applied yet".
 */
export async function notify(input: NotifyInput): Promise<void> {
  const recipients = [...new Set(input.userIds)].filter(
    (id) => id && id !== input.exceptUserId
  )
  if (recipients.length === 0) return

  try {
    const admin = createAdminClient()
    const { error } = await admin.from("notifications").insert(
      recipients.map((userId) => ({
        clinic_id: input.clinicId,
        user_id: userId,
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
      }))
    )
    if (error) throw error
  } catch (err) {
    const migration = pendingMigrationFor(err)
    console.error(
      migration
        ? `notification skipped — run database/migrations/${migration}`
        : "notification failed",
      err
    )
  }
}

export async function listNotifications(
  supabase: DB,
  opts: { limit?: number; unreadOnly?: boolean } = {}
): Promise<Notification[]> {
  try {
    let query = supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(opts.limit ?? 30)

    if (opts.unreadOnly) query = query.is("read_at", null)

    const { data, error } = await query
    if (error) throw error
    // RLS already restricts this to the caller (user_id = auth.uid()), so no filter here.
    return data ?? []
  } catch (err) {
    if (pendingMigrationFor(err)) return []
    throw err
  }
}

export async function countUnreadNotifications(supabase: DB): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null)
    if (error) throw error
    return count ?? 0
  } catch (err) {
    if (pendingMigrationFor(err)) return 0
    throw err
  }
}

export async function markNotificationRead(supabase: DB, notificationId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .is("read_at", null)
  if (error) throw error
}

export async function markAllNotificationsRead(supabase: DB) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null)
  if (error) throw error
}

/**
 * profile ids for a set of professionals — the bridge between the operational tables
 * (which reference `professionals`) and notifications (which reference `profiles`). A
 * professional with no linked login simply has nobody to notify.
 */
export async function profileIdsForProfessionals(
  supabase: DB,
  clinicId: string,
  professionalIds: (string | null | undefined)[]
): Promise<string[]> {
  const ids = [...new Set(professionalIds.filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from("professionals")
    .select("user_id")
    .eq("clinic_id", clinicId)
    .in("id", ids)
  if (error) throw error

  return (data ?? []).map((row) => row.user_id).filter((id): id is string => Boolean(id))
}

/**
 * Everyone in the clinic holding a permission — for "patient arrived" style events that
 * belong to a function rather than to one person.
 *
 * Done as explicit steps rather than one embedded select: `src/types/supabase.ts` is
 * hand-written with `Relationships: []`, so PostgREST embedding gets no type support and
 * would have to be cast. Four small indexed reads are the honest version.
 */
export async function profileIdsWithPermission(
  supabase: DB,
  clinicId: string,
  permissionSlug: string
): Promise<string[]> {
  const { data: permission, error: permissionError } = await supabase
    .from("permissions")
    .select("id")
    .eq("slug", permissionSlug)
    .maybeSingle()
  if (permissionError) throw permissionError
  if (!permission) return []

  const { data: rolePermissions, error: rpError } = await supabase
    .from("role_permissions")
    .select("role_id")
    .eq("permission_id", permission.id)
  if (rpError) throw rpError

  const roleIds = (rolePermissions ?? []).map((r) => r.role_id)
  if (roleIds.length === 0) return []

  const { data: memberships, error: membershipError } = await supabase
    .from("clinic_memberships")
    .select("user_id")
    .eq("clinic_id", clinicId)
    .eq("active", true)
    .in("role_id", roleIds)
  if (membershipError) throw membershipError

  return [...new Set((memberships ?? []).map((m) => m.user_id))]
}

/**
 * Quem está no balcão da recepção.
 *
 * "Recepção" não é um papel neste modelo — é uma função, e `queue.manage` sozinha não a
 * identifica: o profissional TAMBÉM opera a fila (é ele quem chama o paciente). Endereçar o
 * aviso de chamada por `queue.manage` faria cada médico ouvir o toque quando um colega
 * chamasse alguém, o que é exatamente o ruído que faz as pessoas ignorarem alertas.
 *
 * O que separa o balcão da equipe clínica é o caixa: quem atende no balcão opera a fila E
 * recebe o pagamento. Proprietário, administrador e recepcionista têm as duas; o
 * profissional tem só a fila, e o papel financeiro só o caixa.
 *
 * A interseção é feita sobre as duas listas justamente para respeitar exceção por pessoa —
 * quem recebeu ou perdeu uma das duas permissões individualmente entra ou sai do aviso junto.
 */
export async function frontDeskProfileIds(
  supabase: DB,
  clinicId: string
): Promise<string[]> {
  const [naFila, noCaixa] = await Promise.all([
    profileIdsWithPermission(supabase, clinicId, "queue.manage"),
    profileIdsWithPermission(supabase, clinicId, "financial.manage"),
  ])
  const caixa = new Set(noCaixa)
  return naFila.filter((id) => caixa.has(id))
}
