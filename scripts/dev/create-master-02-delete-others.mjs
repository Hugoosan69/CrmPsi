// Phase 2 (destructive): delete every auth user EXCEPT the master created by
// create-master-01-create.mjs.
//
// Run ONLY after phase 1 succeeded — phase 1 moves every clinical foreign key off the
// other users first. Deleting them before that runs fails with a foreign-key violation
// (professionals.user_id, patients.created_by, financial_transactions.created_by,
// payments.received_by, audit_logs.user_id, queue_entries.released_by,
// queue_transfers.transferred_by, files.uploaded_by, service_session_events.created_by,
// and — once migrations/002 is applied — schedule_exceptions.created_by all reference
// profiles(id) with no ON DELETE action).
//
// Deleting an auth user cascades its profiles and clinic_memberships rows only. No
// clinical row is removed — ownership just moves to the master.
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
const MASTER_EMAIL = 'master@csib.local'
const MASTER_PASSWORD = 'Master@2026'

const api = async (path, opts = {}) => {
  const r = await fetch(`${U}${path}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } })
  const body = await r.text()
  return { ok: r.ok, status: r.status, body }
}

const list = await api('/auth/v1/admin/users?per_page=200')
if (!list.ok) {
  console.error('ABORT: não foi possível listar usuários', list.status, list.body.slice(0, 300))
  process.exit(1)
}
const users = JSON.parse(list.body).users ?? []
const master = users.find((u) => u.email === MASTER_EMAIL)

// Refuse to run without a confirmed master — otherwise the clinic is left with no way
// to log in at all.
if (!master) {
  console.error(`ABORT: nenhum usuário ${MASTER_EMAIL} encontrado.`)
  console.error('Rode scripts/dev/create-master-01-create.mjs primeiro.')
  process.exit(1)
}

const membership = await api(
  `/rest/v1/clinic_memberships?select=id,active&user_id=eq.${master.id}`
)
const hasMembership = membership.ok && JSON.parse(membership.body || '[]').some((m) => m.active)
if (!hasMembership) {
  console.error('ABORT: o master existe em auth.users mas não tem clinic_membership ativa.')
  console.error('Rode scripts/dev/create-master-01-create.mjs primeiro (ele cria a membership).')
  process.exit(1)
}

// The rows existing is NOT proof the account works. The incident that produced this
// script had a master with a correct public.profiles row AND an active
// clinic_memberships row that still could not authenticate — the damage was in the auth
// schema, invisible from the public side. Deleting every other account on the strength of
// a row check alone is exactly how a project ends up with zero usable logins, so the
// password grant is exercised for real before anything is destroyed.
const probe = await fetch(`${U}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: H,
  body: JSON.stringify({ email: MASTER_EMAIL, password: MASTER_PASSWORD }),
})
if (!probe.ok) {
  console.error(
    `ABORT: o master existe no banco mas NÃO consegue logar (HTTP ${probe.status}).`
  )
  console.error((await probe.text()).slice(0, 300))
  console.error('Nenhum usuário foi removido. Rode create-master-01-create.mjs novamente.')
  process.exit(1)
}
console.log('login do master verificado — a conta autentica de verdade.\n')

const others = users.filter((u) => u.id !== master.id)
if (others.length === 0) {
  console.log('Nada a fazer — só o master existe.')
  process.exit(0)
}

console.log(`master confirmado: ${master.email} (${master.id})`)
console.log(`removendo ${others.length} outro(s) usuário(s)...\n`)

for (const u of others) {
  const r = await api(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' })
  const detail = r.ok ? '' : ' ' + r.body.slice(0, 240)
  console.log(`delete ${u.email.padEnd(28)} ${r.status}${detail}`)
}

const after = await api('/auth/v1/admin/users?per_page=200')
const remaining = JSON.parse(after.body).users ?? []
console.log('\nusuários restantes:')
for (const u of remaining) console.log('  -', u.email)
