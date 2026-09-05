// Extrai o array JSON de dentro de um arquivo de resultado do MCP execute_sql (que embrulha
// a saída em texto com um preâmbulo e tags <untrusted-data-...>), aplica o remapeamento de
// IDs de profile, e carrega na tabela indicada da homologação via PostgREST.
//
// Uso: node scripts/dev/extract-and-load.mjs <tabela> <arquivo-resultado-mcp.txt> [mapa.json]
import { readFileSync } from 'node:fs'

const [, , table, resultFile, mapPathArg] = process.argv
if (!table || !resultFile) {
  console.error('Uso: node extract-and-load.mjs <tabela> <arquivo-resultado-mcp.txt> [mapa.json]')
  process.exit(1)
}

const fileRaw = readFileSync(resultFile, 'utf8')
// O arquivo é {"result": "Below is...<untrusted-data-...>\n[...]\n</untrusted-data-...>..."}
const raw = JSON.parse(fileRaw).result

const start = raw.indexOf('>\n[') // logo após a tag <untrusted-data-...>
if (start === -1) {
  console.error('Não achei o início do array JSON no arquivo.')
  process.exit(1)
}
const jsonStart = raw.indexOf('[', start)
const end = raw.indexOf('\n</untrusted-data-', jsonStart)
if (end === -1) {
  console.error('Não achei o fim do array JSON no arquivo.')
  process.exit(1)
}
let inner = raw.slice(jsonStart, end)

// select coalesce(jsonb_agg(t), '[]'::jsonb) from ... t  →  [{"coalesce": [ ...rows... ]}]
const wrapper = JSON.parse(inner)
const rows = wrapper[0]?.coalesce ?? []

const env = {}
for (const l of readFileSync('.env.homologa.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const K = env.SUPABASE_SERVICE_ROLE_KEY

const mapPath = mapPathArg || process.env.MAP_PATH
const idMap = mapPath ? JSON.parse(readFileSync(mapPath, 'utf8')) : {}

let text = JSON.stringify(rows)
for (const [oldId, newId] of Object.entries(idMap)) {
  text = text.split(oldId).join(newId)
}
const finalRows = JSON.parse(text)

if (finalRows.length === 0) {
  console.log(`${table}: 0 linhas, nada a carregar.`)
  process.exit(0)
}

const H = {
  apikey: K,
  Authorization: `Bearer ${K}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
}

const BATCH = 100
let inserted = 0
for (let i = 0; i < finalRows.length; i += BATCH) {
  const batch = finalRows.slice(i, i + BATCH)
  const r = await fetch(`${U}/rest/v1/${table}`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify(batch),
  })
  if (!r.ok) {
    const body = await r.text()
    console.error(`${table}: FALHOU no lote ${i}-${i + batch.length} — ${r.status} ${body.slice(0, 800)}`)
    process.exit(1)
  }
  inserted += batch.length
}
console.log(`${table}: ${inserted} linha(s) carregada(s).`)
