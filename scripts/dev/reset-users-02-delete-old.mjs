// Phase 2 (destructive): remove the old CSIB auth users.
//
// Run ONLY after phase 1 (reset-users-01-create.mjs) succeeded. Phase 1 moves every
// clinical foreign key off these profiles; deleting them before that runs will fail
// with a foreign-key violation (professionals.user_id, patients.created_by,
// financial_transactions.created_by, payments.received_by, audit_logs.user_id and
// queue_entries.released_by all reference profiles(id) with no ON DELETE clause).
//
// Deleting the auth user cascades profiles and clinic_memberships only. No clinical
// row is removed.
import { readFileSync } from 'node:fs'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const K = env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }

const OLD = [
  { id: '96be49ce-e7df-4b73-9ca6-87f957c4d7bb', email: 'master@csib.com.br' },
  { id: 'a972d73b-0b36-487b-9bf0-a29f5c0b1b93', email: 'hugo@crm.com.br' },
  { id: 'a2806fba-2ae9-45c0-833c-c0ad22aa1da5', email: 'profissional@csib.demo' },
  { id: '02a4e66b-887a-4358-b6ef-91f7d2be7873', email: 'recepcao@csib.demo' },
  { id: 'e4d4b8f8-48a6-4c0d-b8d9-86a2caee561a', email: 'owner@csib.demo' },
]

// Refuse to run if the new users are not in place — otherwise the clinic is left
// with no way to log in at all.
const check = await fetch(`${U}/rest/v1/profiles?select=id,email&email=like.*%40csib.test`, {
  headers: H,
})
const fresh = await check.json()
if (!Array.isArray(fresh) || fresh.length < 5) {
  console.error(
    `ABORT: expected 5 @csib.test profiles from phase 1, found ${Array.isArray(fresh) ? fresh.length : 0}.`
  )
  console.error('Run scripts/dev/reset-users-01-create.mjs first.')
  process.exit(1)
}
console.log(`phase 1 verified — ${fresh.length} new profiles present.\n`)

for (const u of OLD) {
  const r = await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H })
  const body = r.ok ? '' : ' ' + (await r.text()).slice(0, 240)
  console.log(`delete ${u.email.padEnd(24)} ${r.status}${body}`)
}

const after = await fetch(`${U}/auth/v1/admin/users?per_page=100`, { headers: H })
const list = await after.json()
console.log('\nremaining auth users:')
for (const u of list.users ?? []) console.log('  -', u.email)
