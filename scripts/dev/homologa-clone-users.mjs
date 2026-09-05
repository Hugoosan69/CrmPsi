// Cria, na homologação (CrmPsi_Homologa), um auth.users novo para cada profile real de
// produção (CrmPsi) — mesmo nome/e-mail, senha de demonstração compartilhada — e grava o
// mapeamento old_profile_id -> new_auth_user_id em scratchpad/profile-id-map.json.
//
// Não mexe em profiles/clinic_memberships aqui: a cópia de dados (que já usa esse mapa
// para remapear qualquer coluna que referencie profiles(id)) cuida disso depois, tabela por
// tabela, para não duplicar a inserção do profile.
//
// Requer .env.homologa.local (gitignored) com:
//   NEXT_PUBLIC_SUPABASE_URL=https://hlaqagoxkwqrwaoubhpg.supabase.co
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

const DEMO_PASSWORD = 'Homolog@Csib2026'

// Snapshot de public.profiles em produção (id, full_name, email) — só o necessário para
// criar a conta equivalente na homologação. Sem telefone/avatar: isso é dado de negócio,
// copiado junto com o resto na etapa de dados, não na de auth.
const PRODUCTION_PROFILES = [
  { id: '4411e573-a6cb-4798-9fc9-91326708a478', full_name: 'Administrador', email: 'hugoosan69@gmail.com' },
  { id: 'a90a7f33-9045-453b-b6c9-1b16b2a14c35', full_name: 'Vagner', email: 'master@csib.com' },
  { id: '0dafb91f-3bf3-42aa-8160-39af5f502e37', full_name: 'Millena', email: 'millena@csib.com' },
  { id: 'c46ff299-ff6b-4da9-a2a2-e9e3b221112d', full_name: 'Thiago Ramos', email: 'thiagorc85@gmail.com' },
  { id: '97651a73-87e7-4fd4-8f88-b6d913da2d61', full_name: 'Myrella Nathaly de Freitas Dias de Medeiros', email: 'myrellafreitas2705@gmail.com' },
  { id: 'a2c30abd-57ac-4ce9-9af4-09799dfdc9d6', full_name: 'crysthian sergio santos souza', email: 'crysthiansergio19@gmail.com' },
  { id: '5a9cc54a-9243-4a35-bc62-d0a3e687ec3c', full_name: 'ANDREIA GUIMARAES', email: 'Andreia@csib.com' },
  { id: 'a57a2266-5feb-48b9-9047-87edf82bfe6a', full_name: 'Layanne Carla lima Nascimento', email: 'Layanne@csib.com' },
  { id: 'ab66cc34-ecac-4267-95b0-eca97890db92', full_name: 'Robledo Rodrigues', email: 'Robledo@csib.com' },
  { id: '2f797b80-61bb-44f6-9f26-e1702c6ccf64', full_name: 'Wanduil', email: 'Wanduil@csib.com' },
  { id: 'fd9cb9b8-741b-4001-8ea0-8a559d7577f9', full_name: 'Elem Aureliano', email: 'Elem@csib.com' },
  { id: '1d18bd0c-11fd-4a41-9bf1-a3a720979168', full_name: 'Leticia Sherley', email: 'Leticia@csib.com' },
  { id: 'b1057fe2-085a-4442-927b-db4ba45f6d0e', full_name: 'Marianna', email: 'Marianna@csib.com' },
  { id: '796eddec-58b5-4e2a-8ea1-1c84ccc8c9e8', full_name: 'Kennya', email: 'Kennya@csib.com' },
  { id: 'd3328380-9ee7-499c-b521-104765fea823', full_name: 'Amanda Gonçalves', email: 'Amanda@csib.com' },
  { id: '4a2e30c7-0106-4f16-9fda-8aacec9fa343', full_name: 'Nathalia Reis', email: 'Nathalia@csib.com' },
  { id: '2c536111-8ec3-4ec3-8923-da9d4fbce37f', full_name: 'Tarley Magalhaes', email: 'Tarley@csib.com' },
  { id: '27624e8a-87b3-4fe3-a92e-475adadee4d5', full_name: 'Soyama silva', email: 'Soyama@csib.com' },
  { id: '762447a0-e682-4256-9277-c2d41925efa5', full_name: 'Wagner', email: 'Wagner@csib.com' },
  { id: 'f5c5d3a7-2071-4724-bd0c-df660afcfa8f', full_name: 'Marina queir', email: 'marina@csib.com' },
]

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
