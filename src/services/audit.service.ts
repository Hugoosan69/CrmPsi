import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import type { Json } from "@/types/supabase"

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
