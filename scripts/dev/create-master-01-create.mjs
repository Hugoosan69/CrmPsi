// Phase 1 (additive, non-destructive): create ONE master user (role: owner) via the
// Supabase Auth Admin API, then re-point every clinical foreign key that currently
// references profiles(id) — from EVERY OTHER user that owns rows — onto the master.
//
// Why the Admin API and not a raw `insert into auth.users`: that table belongs to
// GoTrue and is not a supported write surface — column shape drifts between Supabase
// versions (e.g. auth.identities.provider_id doesn't exist on older projects), and
// NOT NULL columns with no default (confirmation_token, email_change, etc. on some
// schema versions) commonly trip up a hand-written INSERT. The Admin API is what
// Supabase itself uses to create users and is stable across project versions — this is
// the same mechanism reset-users-01-create.mjs already used successfully.
//
// Run phase 2 (create-master-02-delete-others.mjs) after this succeeds.
import { readFileSync } from 'node:fs'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const K = env.SUPABASE_SERVICE_ROLE_KEY
if (!U || !K) {
  console.error('ABORT: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes em .env.local')
  process.exit(1)
}
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }

const CLINIC = '00000000-0000-0000-0000-000000000001'
const OWNER_ROLE = '00000000-0000-0000-0000-000000000010'

const MASTER_EMAIL = 'master@csib.local'
const MASTER_PASSWORD = 'Master@2026'
const MASTER_NAME = 'Master CSIB'

const api = async (path, opts = {}) => {
  const r = await fetch(`${U}${path}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } })
  const body = await r.text()
  return { ok: r.ok, status: r.status, body }
}

// --- 1. auth.users, via Admin API ---------------------------------------------------
const list = await api('/auth/v1/admin/users?per_page=200')
if (!list.ok) {
  console.error('ABORT: não foi possível listar usuários existentes', list.status, list.body.slice(0, 300))
  process.exit(1)
}
const existingUsers = JSON.parse(list.body).users ?? []
let master = existingUsers.find((u) => u.email === MASTER_EMAIL)

if (master) {
  // Already exists — just make sure the password is what this script expects.
  const upd = await api(`/auth/v1/admin/users/${master.id}`, {
    method: 'PUT',
    body: JSON.stringify({ password: MASTER_PASSWORD }),
  })
  console.log(`master já existia (${master.id}) — senha redefinida: ${upd.status}`)
} else {
  const created = await api('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email: MASTER_EMAIL, password: MASTER_PASSWORD, email_confirm: true }),
  })
  if (!created.ok) {
    console.error('ABORT: falha ao criar o usuário master', created.status, created.body.slice(0, 300))
    process.exit(1)
  }
  master = JSON.parse(created.body)
  console.log(`master criado: ${master.id}`)
}

const masterId = master.id

// --- 2. profiles ---------------------------------------------------------------------
const profile = await api('/rest/v1/profiles', {
  method: 'POST',
  headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify({ id: masterId, full_name: MASTER_NAME, email: MASTER_EMAIL, active: true }),
})
console.log(`profiles upsert: ${profile.status}${profile.ok ? '' : ' ' + profile.body.slice(0, 240)}`)

// --- 3. clinic_memberships ------------------------------------------------------------
// `on_conflict` is required here and NOT optional: PostgREST resolves
// `resolution=merge-duplicates` against the PRIMARY KEY unless told otherwise, and this
// table's PK is `id uuid default gen_random_uuid()`. Since the body carries no `id`, every
// request mints a fresh uuid, never collides on the PK, and falls through to a plain
// INSERT — which then violates the real constraint, `unique (clinic_id, user_id)`, with a
// 409 on any second run. Naming the conflict target is what makes this actually idempotent.
const membership = await api('/rest/v1/clinic_memberships?on_conflict=clinic_id,user_id', {
  method: 'POST',
  headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify({ clinic_id: CLINIC, user_id: masterId, role_id: OWNER_ROLE, active: true }),
})
console.log(`clinic_memberships upsert: ${membership.status}${membership.ok ? '' : ' ' + membership.body.slice(0, 240)}`)

// --- 4. re-point every column that references profiles(id) ---------------------------
// Kept in one place, and dynamic (fetched from the live user list) rather than a
// hardcoded id list — reset-users-01-create.mjs learned this the hard way: a static
// list of "old" ids goes stale the moment the accounts on the project change.
const otherIds = existingUsers.map((u) => u.id).filter((id) => id !== masterId)

// Every column in the schema that references profiles(id) without ON DELETE CASCADE.
// A table from a migration that has not been applied yet (PGRST205 / 42P01) is skipped
// rather than aborting — this script must work whether migrations 002/004 are in place.
const REFS = [
  ['professionals', 'user_id'],
  ['patients', 'created_by'],
  ['appointments', 'created_by'],
  ['financial_transactions', 'created_by'],
  ['payments', 'received_by'],
  ['audit_logs', 'user_id'],
  ['queue_entries', 'released_by'],
  ['queue_transfers', 'transferred_by'],
  ['files', 'uploaded_by'],
  ['service_session_events', 'created_by'],
  ['schedule_exceptions', 'created_by'], // migrations/002
  ['conversations', 'created_by'], // migrations/004
]

console.log(`\n=== re-apontando referências clínicas de ${otherIds.length} outro(s) usuário(s) para o master ===`)
for (const [table, column] of REFS) {
  let touched = 0
  for (const oldId of otherIds) {
    const r = await api(`/rest/v1/${table}?${column}=eq.${oldId}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ [column]: masterId }),
    })
    if (!r.ok) {
      // PGRST205/PGRST204: table or column doesn't exist yet (migration not applied) —
      // not an error worth stopping for.
      if (r.body.includes('PGRST205') || r.body.includes('PGRST204') || r.status === 404) continue
      console.log(`  ${table}.${column} <- ${oldId.slice(0, 8)}  ERRO ${r.status} ${r.body.slice(0, 160)}`)
      continue
    }
    const rows = JSON.parse(r.body || '[]').length
    if (rows) {
      touched += rows
      console.log(`  ${table}.${column}: ${rows} linha(s) de ${oldId.slice(0, 8)} -> master`)
    }
  }
  if (touched === 0) console.log(`  ${table}.${column}: nada a repontar`)
}

// Tables the chat feature (migrations/004) owns outright — reassigning is meaningless
// (a message needs exactly one sender), so these rows are deleted instead, only if the
// table exists.
for (const table of ['internal_messages', 'conversation_participants', 'notifications']) {
  const probe = await api(`/rest/v1/${table}?select=id&limit=1`)
  if (!probe.ok) continue // migration 004 not applied — nothing to clean
  const column = table === 'internal_messages' ? 'sender_id' : 'user_id'
  for (const oldId of otherIds) {
    await api(`/rest/v1/${table}?${column}=eq.${oldId}`, { method: 'DELETE' })
  }
  console.log(`  ${table}: linhas de outros usuários removidas`)
}

console.log(`\nfase 1 concluída — master pronto (${MASTER_EMAIL} / ${MASTER_PASSWORD}). Nenhum usuário foi apagado ainda.`)
console.log('Rode scripts/dev/create-master-02-delete-others.mjs para remover os demais.')
