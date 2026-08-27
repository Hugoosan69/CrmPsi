// Phase 1 (additive, non-destructive): create the new CSIB test users
// (auth user + profiles row + clinic_membership), then re-point clinical
// foreign keys from the old profiles to the new equivalents so that no
// clinical row is lost when the old auth users are removed in phase 2.
import { readFileSync } from 'node:fs'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const K = env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }

const CLINIC = '00000000-0000-0000-0000-000000000001'
const ROLE = {
  owner: '00000000-0000-0000-0000-000000000010',
  admin: '00000000-0000-0000-0000-000000000011',
  receptionist: '00000000-0000-0000-0000-000000000012',
  professional: '00000000-0000-0000-0000-000000000013',
  financial: '00000000-0000-0000-0000-000000000014',
}

const PASS = 'Csib@2026'
const NEW = [
  { email: 'owner@csib.test', name: 'Helena Nogueira', role: 'owner' },
  { email: 'admin@csib.test', name: 'Marcos Rezende', role: 'admin' },
  { email: 'recepcao@csib.test', name: 'Bruna Alcântara', role: 'receptionist' },
  { email: 'profissional@csib.test', name: 'Dr. Carlos Silva', role: 'professional' },
  { email: 'financeiro@csib.test', name: 'Paula Menezes', role: 'financial' },
]

const api = async (p, o = {}) => {
  const r = await fetch(`${U}${p}`, { ...o, headers: { ...H, ...(o.headers || {}) } })
  const body = await r.text()
  return { ok: r.ok, status: r.status, body }
}

const created = {}

for (const u of NEW) {
  const r = await api('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email: u.email, password: PASS, email_confirm: true }),
  })
  if (!r.ok) {
    console.log('AUTH FAIL', u.email, r.status, r.body.slice(0, 240))
    continue
  }
  const id = JSON.parse(r.body).id
  created[u.role] = id

  const p = await api('/rest/v1/profiles', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ id, full_name: u.name, email: u.email, active: true }),
  })
  const m = await api('/rest/v1/clinic_memberships', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: id, clinic_id: CLINIC, role_id: ROLE[u.role], active: true }),
  })
  console.log(`created ${u.email.padEnd(24)} role=${u.role.padEnd(13)} profile=${p.status} membership=${m.status}`)
  if (!p.ok) console.log('  profile err:', p.body.slice(0, 240))
  if (!m.ok) console.log('  membership err:', m.body.slice(0, 240))
}

console.log('\nnew profile ids:', JSON.stringify(created, null, 1))

// Old profile -> new profile, matched by equivalent operating role so that
// "who created this record" stays semantically correct after the swap.
const MAP = {
  'e4d4b8f8-48a6-4c0d-b8d9-86a2caee561a': created.owner, // owner@csib.demo
  '02a4e66b-887a-4358-b6ef-91f7d2be7873': created.receptionist, // recepcao@csib.demo
  'a2806fba-2ae9-45c0-833c-c0ad22aa1da5': created.professional, // profissional@csib.demo
  '96be49ce-e7df-4b73-9ca6-87f957c4d7bb': created.owner, // master@csib.com.br
}

// Every column in the schema that references profiles(id) without ON DELETE CASCADE.
//
// Keep this list complete: a column missing here does not corrupt anything, but it makes
// phase 2 fail with a foreign-key violation for whichever user still owns those rows.
// `service_session_events.created_by` was missed on the first run for exactly that reason
// — it is on the *events* table, not on `service_sessions`.
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
]

console.log('\n=== re-pointing clinical references ===')
for (const [t, c] of REFS) {
  for (const [oldId, newId] of Object.entries(MAP)) {
    if (!newId) {
      console.log(`  SKIP ${t}.${c} (new id missing)`)
      continue
    }
    const r = await api(`/rest/v1/${t}?${c}=eq.${oldId}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ [c]: newId }),
    })
    if (!r.ok) {
      console.log(`  ${t}.${c} <- ${oldId.slice(0, 8)}  ERR ${r.status} ${r.body.slice(0, 160)}`)
      continue
    }
    const n = JSON.parse(r.body).length
    if (n) console.log(`  ${t}.${c}: ${n} row(s) ${oldId.slice(0, 8)} -> ${newId.slice(0, 8)}`)
  }
}

console.log('\nphase 1 done — no data deleted.')
