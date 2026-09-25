import { NextResponse, type NextRequest } from "next/server"
import { timingSafeEqual } from "node:crypto"

import { createAdminClient } from "@/lib/supabase/admin"
import { processInboundWhatsapp } from "@/services/communication.service"
import { recordAudit } from "@/services/audit.service"

export const dynamic = "force-dynamic"

/**
 * Recebe a resposta de um paciente pelo WhatsApp — o n8n encaminha para cá quando o WAHA
 * avisa de uma mensagem nova. Mesma autenticação e o mesmo desenho do `/outbox`: o token da
 * integração n8n identifica a clínica, e o CRM decide o que fazer com o texto — aqui, se ele
 * confirma uma consulta.
 */

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
  return NextResponse.json({ error: "unauthorized" }, { status: 401 })
}

export async function POST(request: NextRequest) {
  const token = request.headers.get("x-csib-token")
  if (!token) return unauthorized()

  const clinicId = await clinicForToken(token)
  if (!clinicId) return unauthorized()

  let body: { from?: string; text?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const from = (body.from ?? "").trim()
  const text = (body.text ?? "").trim()
  if (!from || !text) {
    return NextResponse.json({ error: "missing_from_or_text" }, { status: 400 })
  }

  const admin = createAdminClient()
  const result = await processInboundWhatsapp(admin, clinicId, { fromNumber: from, body: text })

  if (result.confirmed) {
    await recordAudit({
      clinicId,
      userId: null,
      action: "appointment.confirm",
      entityType: "appointment",
      entityId: result.appointmentId,
      after: { via: "whatsapp_reply", from, text: text.slice(0, 200) },
    })
  }

  return NextResponse.json({
    ok: true,
    patientFound: Boolean(result.patientId),
    confirmed: result.confirmed,
  })
}
