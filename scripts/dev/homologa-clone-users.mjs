// Cria, na homologação (CrmPsi_Homologa), um auth.users novo para cada profile real de
// produção (CrmPsi) — mesmo nome/e-mail, senha de demonstração compartilhada — e grava o
// mapeamento old_profile_id -> new_auth_user_id em scratchpad/profile-id-map.json.
//
// Não mexe em profiles/clinic_memberships aqui: a cópia de dados (que já usa esse mapa
// para remapear qualquer coluna que referencie profiles(id)) cuida disso depois, tabela por
// tabela, para não duplicar a inserção do profile.
//
// Requer .env.homologa.local (gitignored) com:
//   NEXT_PUBLIC_SUPABASE_URL=<url do projeto de homologacao>
//   SUPABASE_SERVICE_ROLE_KEY=<service_role secret do painel do projeto de homologação>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const env = {}
for (const l of readFileSync('.env.homologa.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const K = env.SUPABASE_SERVICE_ROLE_KEY
if (!U || !K) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY em .env.homologa.local')
  process.exit(1)
}
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }

// Nunca no repositório: este repo é PÚBLICO, e esta senha vale para contas de um banco
// que contém dados reais copiados da produção.
const DEMO_PASSWORD = env.HOMOLOG_DEMO_PASSWORD
if (!DEMO_PASSWORD) {
  console.error('Falta HOMOLOG_DEMO_PASSWORD em .env.homologa.local')
  process.exit(1)
}

// Snapshot de public.profiles da produção (id, full_name, email).
//
// Fica FORA do repositório: são nome e e-mail de pessoas reais, e este repo é público.
// Gere o arquivo com uma consulta ao banco de produção:
//
//   select json_agg(json_build_object('id', id, 'full_name', full_name, 'email', email))
//   from public.profiles;
//
// e salve o resultado em scripts/dev/.profiles.local.json (ignorado pelo git).
const PERFIS = 'scripts/dev/.profiles.local.json'
let PRODUCTION_PROFILES
try {
  PRODUCTION_PROFILES = JSON.parse(readFileSync(PERFIS, 'utf8'))
} catch {
  console.error(`Falta ${PERFIS} — veja o comentário no topo deste arquivo.`)
  process.exit(1)
}

const api = async (p, o = {}) => {
  const r = await fetch(`${U}${p}`, { ...o, headers: { ...H, ...(o.headers || {}) } })
  const body = await r.text()
  return { ok: r.ok, status: r.status, body }
}

const map = {}
const failures = []

for (const p of PRODUCTION_PROFILES) {
  const r = await api('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: p.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: p.full_name },
    }),
  })
  if (!r.ok) {
    console.log('FALHOU', p.email, r.status, r.body.slice(0, 240))
    failures.push(p)
    continue
  }
  const newId = JSON.parse(r.body).id
  map[p.id] = newId
  console.log(`ok  ${p.email.padEnd(40)} ${p.id} -> ${newId}`)
}

const outDir = process.env.MAP_OUT_DIR || '.'
mkdirSync(outDir, { recursive: true })
const outPath = `${outDir}/profile-id-map.json`
writeFileSync(outPath, JSON.stringify(map, null, 2))

console.log(`\n${Object.keys(map).length}/${PRODUCTION_PROFILES.length} usuários criados.`)
console.log('Senha de demonstração (todos):', DEMO_PASSWORD)
console.log('Mapa salvo em', outPath)
if (failures.length) {
  console.log('\nFalharam:', failures.map((f) => f.email).join(', '))
}
