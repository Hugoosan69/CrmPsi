// Carrega um array JSON de linhas (extraído de produção) numa tabela da homologação,
// substituindo qualquer UUID de profile antigo pelo novo (mapa gerado por
// homologa-clone-users.mjs) em qualquer coluna onde apareça — sem precisar saber quais
// colunas são FK para profiles.
//
// Uso: node scripts/dev/homologa-load-table.mjs <tabela> <arquivo.json> [mapa.json]
import { readFileSync } from 'node:fs'

const [, , table, jsonPath, mapPathArg] = process.argv
if (!table || !jsonPath) {
  console.error('Uso: node homologa-load-table.mjs <tabela> <arquivo.json> [mapa.json]')
  process.exit(1)
}

const env = {}
for (const l of readFileSync('.env.homologa.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const K = env.SUPABASE_SERVICE_ROLE_KEY

const mapPath = mapPathArg || process.env.MAP_PATH
const idMap = mapPath ? JSON.parse(readFileSync(mapPath, 'utf8')) : {}

let raw = readFileSync(jsonPath, 'utf8')
for (const [oldId, newId] of Object.entries(idMap)) {
  raw = raw.split(oldId).join(newId)
}

const rows = JSON.parse(raw)
if (!Array.isArray(rows) || rows.length === 0) {
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
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH)
  const r = await fetch(`${U}/rest/v1/${table}`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify(batch),
  })
  if (!r.ok) {
    const body = await r.text()
    console.error(`${table}: FALHOU no lote ${i}-${i + batch.length} — ${r.status} ${body.slice(0, 500)}`)
    process.exit(1)
  }
  inserted += batch.length
}
console.log(`${table}: ${inserted} linha(s) carregada(s).`)
