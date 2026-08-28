import { NextResponse, type NextRequest } from "next/server"
import { timingSafeEqual } from "node:crypto"

import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

/**
 * Caixa de saída para o n8n.
 *
 * O n8n consulta este endereço de tempos em tempos (5 minutos é o intervalo previsto), recebe
 * as mensagens cujo horário já chegou, envia cada uma pelo WhatsApp e devolve o resultado por
 * POST. É o desenho combinado: o CSIB decide O QUE e QUANDO enviar; o n8n decide COMO.
 *
 * Por que não um cron dentro da aplicação: a Vercel executa funções sob demanda, sem processo
 * de fundo. Um "worker" aqui só rodaria quando alguém abrisse uma página — o que faria a
 * mensagem de aniversário depender de haver movimento no sistema naquele minuto.
 *
 * Autenticação pelo mesmo token da integração n8n, gravado em clinic_settings. A clínica é
 * DEDUZIDA do token em vez de vir na URL: aceitar clinic_id como parâmetro deixaria qualquer
 * um com um token válido ler a fila de outro tenant.
 */

/** Comparação em tempo constante — comparar segredos com === vaza o tamanho do prefixo
 *  correto por diferença de tempo, e este endpoint é público. */
function tokensMatch(a: string, b: string) {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

type N8nSettings = { secret?: string | null; enabled?: boolean }

async function clinicForToken(token: string) {
  const admin = createAdminClient()
  const { data, error } = await admin.from("clinic_settings").select("clinic_id, settings")
  if (error) throw error

  for (const row of data ?? []) {
    const settings = row.settings as { integrations?: { n8n?: N8nSettings } } | null
    const secret = settings?.integrations?.n8n?.secret
    if (secret && tokensMatch(secret, token)) return row.clinic_id as string
  }
  return null
}

function unauthorized() {
  // Mesma resposta para token ausente e token errado: distinguir os dois confirma para quem
  // sonda que o endpoint existe e que só falta acertar o segredo.
  return NextResponse.json({ error: "unauthorized" }, { status: 401 })
}

/** GET — o que já venceu e ainda não saiu. */
export async function GET(request: NextRequest) {
  const token = request.headers.get("x-csib-token")
  if (!token) return unauthorized()

  const clinicId = await clinicForToken(token)
  if (!clinicId) return unauthorized()

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("messages")
    .select("id, patient_id, channel, type, payload, scheduled_at, patients(full_name, social_name, phone, whatsapp, email)")
    .eq("clinic_id", clinicId)
    .eq("status", "queued")
    // Sem scheduled_at é envio imediato; com data, só quando vencer. `or` cobre os dois.
    .or(`scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()}`)
    .order("scheduled_at", { ascending: true, nullsFirst: true })
    .limit(200)

  if (error) {
    console.error("outbox: leitura falhou", error)
    return NextResponse.json({ error: "read_failed" }, { status: 500 })
  }

  const messages = (data ?? []).map((row) => {
    const patient = row.patients as unknown as {
      full_name: string
      social_name: string | null
      phone: string | null
      whatsapp: string | null
      email: string | null
    } | null
    const payload = (row.payload ?? {}) as { body?: string; subject?: string | null }

    // O destino depende do canal: WhatsApp prefere o número dedicado quando existe, porque
    // muita gente usa um telefone fixo como contato e outro para mensagens.
    const to =
      row.channel === "email"
        ? patient?.email
        : row.channel === "whatsapp"
          ? patient?.whatsapp || patient?.phone
          : patient?.phone

    return {
      id: row.id,
      patientId: row.patient_id,
      patientName: patient?.social_name || patient?.full_name || "",
      channel: row.channel,
      type: row.type,
      to: to ?? null,
      subject: payload.subject ?? null,
      body: payload.body ?? "",
      scheduledAt: row.scheduled_at,
    }
  })

  return NextResponse.json({ count: messages.length, messages })
}

/**
 * POST — o n8n reporta o resultado.
 *
 * Corpo: { results: [{ id, status: "sent" | "failed", detail?: string }] }
 *
 * Reportar é obrigatório e não opcional: sem isso a mensagem continuaria "queued" e sairia
 * de novo na próxima varredura, cinco minutos depois, e o paciente receberia a mesma
 * mensagem repetidamente até alguém perceber.
 */
export async function POST(request: NextRequest) {
  const token = request.headers.get("x-csib-token")
  if (!token) return unauthorized()

  const clinicId = await clinicForToken(token)
  if (!clinicId) return unauthorized()

  let body: { results?: { id: string; status: string; detail?: string }[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const results = body.results ?? []
  if (!Array.isArray(results) || results.length === 0) {
    return NextResponse.json({ error: "no_results" }, { status: 400 })
  }

  const admin = createAdminClient()
  let updated = 0

  for (const result of results) {
    if (!result?.id) continue
    const status = result.status === "sent" ? "sent" : "failed"

    const { error } = await admin
      .from("messages")
      .update({
        status,
        sent_at: status === "sent" ? new Date().toISOString() : null,
        provider_response: { provider: "n8n", detail: result.detail ?? null },
      })
      .eq("id", result.id)
      // Filtrado pela clínica do token: sem isto um token válido poderia marcar como
      // enviada uma mensagem de outro tenant.
      .eq("clinic_id", clinicId)

    if (error) console.error("outbox: update falhou para", result.id, error)
    else updated += 1
  }

  return NextResponse.json({ updated })
}
