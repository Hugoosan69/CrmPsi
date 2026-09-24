import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { createAdminClient } from "@/lib/supabase/admin"
import type { Database, Json } from "@/types/supabase"

type DB = SupabaseClient<Database>

export type AuditEntry = {
  clinicId: string | null
  userId: string | null
  action: string
  entityType: string
  entityId?: string | null
  before?: Json | null
  after?: Json | null
}

/**
 * Fire-and-forget audit trail (item 22). Uses the service-role client because
 * audit_logs intentionally has no client-facing insert policy — only the backend writes
 * here, always after the mutation it describes has already committed.
 */
export async function recordAudit(entry: AuditEntry) {
  const admin = createAdminClient()
  const { error } = await admin.from("audit_logs").insert({
    clinic_id: entry.clinicId,
    user_id: entry.userId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
  })
  if (error) {
    console.error(`audit_logs insert failed for action "${entry.action}"`, error)
  }
}

// ---------------------------------------------------------------------------
// Leitura — página /gestao/auditoria
// ---------------------------------------------------------------------------

export type AuditLogRow = {
  id: string
  action: string
  entityType: string
  entityId: string | null
  before: Json | null
  after: Json | null
  createdAt: string
  userId: string | null
  userName: string | null
}

export type AuditFilters = {
  dateFrom?: string | null
  dateTo?: string | null
  userId?: string | null
  entityType?: string | null
  action?: string | null
  search?: string | null
}

export async function listAuditLogs(
  supabase: DB,
  clinicId: string,
  filters: AuditFilters,
  offset: number,
  limit: number
): Promise<{ rows: AuditLogRow[]; total: number }> {
  let query = supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, before, after, created_at, user_id", {
      count: "exact",
    })
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })

  if (filters.dateFrom) {
    query = query.gte("created_at", `${filters.dateFrom}T00:00:00`)
  }
  if (filters.dateTo) {
    query = query.lte("created_at", `${filters.dateTo}T23:59:59`)
  }
  if (filters.userId) {
    query = query.eq("user_id", filters.userId)
  }
  if (filters.entityType) {
    query = query.eq("entity_type", filters.entityType)
  }
  if (filters.action) {
    query = query.eq("action", filters.action)
  }
  if (filters.search) {
    query = query.ilike("action", `%${filters.search}%`)
  }

  query = query.range(offset, offset + limit - 1)

  const { data, count, error } = await query
  if (error) throw error

  const userIds = [...new Set((data ?? []).map((r) => r.user_id).filter(Boolean))] as string[]
  const nameMap = await profileNames(supabase, userIds)

  const rows: AuditLogRow[] = (data ?? []).map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    before: r.before,
    after: r.after,
    createdAt: r.created_at,
    userId: r.user_id,
    userName: r.user_id ? nameMap.get(r.user_id) ?? null : null,
  }))

  return { rows, total: count ?? 0 }
}

export async function getAuditEntityTypes(
  supabase: DB,
  clinicId: string
): Promise<string[]> {
  const { data } = await supabase
    .from("audit_logs")
    .select("entity_type")
    .eq("clinic_id", clinicId)
    .order("entity_type")
    .limit(200)

  return [...new Set((data ?? []).map((r) => r.entity_type))].sort()
}

export async function getAuditActions(
  supabase: DB,
  clinicId: string
): Promise<string[]> {
  const { data } = await supabase
    .from("audit_logs")
    .select("action")
    .eq("clinic_id", clinicId)
    .order("action")
    .limit(500)

  return [...new Set((data ?? []).map((r) => r.action))].sort()
}

async function profileNames(
  supabase: DB,
  userIds: string[]
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map()
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds)
  return new Map((data ?? []).map((p) => [p.id, p.full_name]))
}
