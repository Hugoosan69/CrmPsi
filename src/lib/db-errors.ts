/**
 * Postgres/PostgREST errors reach the UI as raw objects (`{code, details, hint, message}`),
 * which render as an unreadable blob and tell an operator nothing. This turns the ones we
 * can recognise into plain Portuguese.
 *
 * Deliberately does NOT paper over a schema that is behind — a missing column or enum
 * value is reported as exactly that, with the migration to run, instead of being silently
 * swallowed or faked with placeholder data.
 */

type MaybePostgrestError = {
  code?: unknown
  message?: unknown
  details?: unknown
  hint?: unknown
}

/** Signatures of "the database schema is older than this code". */
const MIGRATION_SIGNATURES: { code: string; test: (message: string) => boolean; migration: string }[] = [
  {
    // Enum value the code uses but the type doesn't have yet.
    code: "22P02",
    test: (m) => m.includes("enum queue_status"),
    migration: "001_payment_gate_and_timer.sql",
  },
  {
    // PostgREST schema cache: column referenced that doesn't exist.
    code: "PGRST204",
    test: (m) =>
      m.includes("financial_transaction_id") ||
      m.includes("released_at") ||
      m.includes("released_by") ||
      m.includes("checked_in_at") ||
      m.includes("effective_seconds") ||
      m.includes("total_seconds"),
    migration: "001_payment_gate_and_timer.sql",
  },
  {
    // Agenda foundation: rooms, availability, exceptions and the slot-check functions.
    code: "PGRST204",
    test: (m) => m.includes("room_id") || m.includes("time_range"),
    migration: "002_agenda_foundation.sql",
  },
  {
    // Table or RPC from 002 not present yet — PostgREST reports an unknown relation.
    code: "PGRST205",
    test: (m) =>
      m.includes("rooms") ||
      m.includes("professional_availability") ||
      m.includes("schedule_exceptions"),
    migration: "002_agenda_foundation.sql",
  },
  {
    // RPC missing: appointment_slot_problem / professional_free_slots / clinic_occupancy.
    code: "PGRST202",
    test: (m) =>
      m.includes("appointment_slot_problem") ||
      m.includes("professional_free_slots") ||
      m.includes("clinic_occupancy"),
    migration: "002_agenda_foundation.sql",
  },
  {
    // Internal chat and notifications. Without these signatures the notification bell —
    // which is mounted on every screen — throws on an un-migrated database instead of
    // degrading to an empty inbox.
    code: "PGRST205",
    test: (m) =>
      m.includes("notifications") ||
      m.includes("conversations") ||
      m.includes("conversation_participants") ||
      m.includes("internal_messages"),
    migration: "004_internal_comms.sql",
  },
  {
    code: "PGRST202",
    test: (m) => m.includes("is_conversation_participant"),
    migration: "004_internal_comms.sql",
  },
]

function asPostgrestError(err: unknown): MaybePostgrestError | null {
  if (err && typeof err === "object") return err as MaybePostgrestError
  return null
}

/** Returns the migration filename when the error means "schema is behind", else null. */
export function pendingMigrationFor(err: unknown): string | null {
  const e = asPostgrestError(err)
  if (!e) return null
  const code = typeof e.code === "string" ? e.code : ""
  const message = typeof e.message === "string" ? e.message : ""

  for (const sig of MIGRATION_SIGNATURES) {
    if (code === sig.code && sig.test(message)) return sig.migration
  }
  return null
}

/** Human-readable message for any database error, safe to show in the UI. */
export function describeDbError(err: unknown): string {
  const migration = pendingMigrationFor(err)
  if (migration) {
    return `O banco de dados está desatualizado para esta versão do sistema. Rode a migration database/migrations/${migration} no SQL Editor do Supabase e recarregue a página.`
  }

  const e = asPostgrestError(err)
  const message = typeof e?.message === "string" ? e.message : ""

  if (message.includes("enforce_queue_payment_gate") || message.includes("Pagamento pendente")) {
    return "Pagamento pendente: este paciente precisa ter o pagamento confirmado antes de entrar na fila."
  }
  if (typeof e?.code === "string" && e.code === "23505") {
    return "Já existe um registro com estes dados. Verifique se o horário ou o cadastro não está duplicado."
  }
  // Exclusion constraint — the double-booking backstop from migrations/002 firing because
  // someone else took the slot between the availability check and the insert.
  if (typeof e?.code === "string" && e.code === "23P01") {
    if (message.includes("room")) {
      return "Esta sala acabou de ser reservada para este horário. Escolha outra sala ou outro horário."
    }
    return "Este horário acabou de ser ocupado para este profissional. Recarregue a agenda e escolha outro horário."
  }

  return message || "Não foi possível concluir a operação. Tente novamente."
}

/** Wraps a database call so anything it throws surfaces as a readable Error. */
export async function withDbError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    console.error("database error", err)
    throw new Error(describeDbError(err))
  }
}
