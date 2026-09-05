import { NextResponse, type NextRequest } from "next/server"
import { timingSafeEqual } from "node:crypto"

import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

/**
 * Aviso de atendimentos em aberto, para o sino.
 *
 * O banner na agenda só existe para quem abriu a agenda — e o problema é justamente o
 * profissional que atendeu, foi embora e nunca marcou nada. Este endereço é consultado
 * pelo n8n (mesmo mecanismo e mesmo token da caixa de saída de mensagens, ver
 * `api/integrations/outbox`) e gera uma notificação por profissional que tenha consultas
 * vencidas sem fechamento.
 *
 * Roda uma vez por dia, não a cada varredura: a notificação é criada só se aquele
 * profissional ainda não recebeu uma hoje. Sem isso, um cron de 5 minutos encheria o sino
 * com o mesmo aviso 288 vezes por dia — e um sino que grita sempre é um sino que ninguém
 * olha.
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

  const admin = createAdminClient()

  const { data: pending, error } = await admin
    .from("appointments")
    .select("id, professional_id")
    .eq("clinic_id", clinicId)
    .in("status", ["scheduled", "confirmed"])
    .lt("scheduled_at", new Date().toISOString())

  if (error) {
    console.error("pending-closures: leitura falhou", error)
    return NextResponse.json({ error: "read_failed" }, { status: 500 })
  }

  const countByProfessional = new Map<string, number>()
  for (const appointment of pending ?? []) {
    if (!appointment.professional_id) continue
    countByProfessional.set(
      appointment.professional_id,
      (countByProfessional.get(appointment.professional_id) ?? 0) + 1
    )
  }
  if (countByProfessional.size === 0) {
    return NextResponse.json({ notified: 0, pending: 0 })
  }

  // profiles(id) é o destinatário da notificação; professionals.user_id é a ponte.
  const { data: professionals } = await admin
    .from("professionals")
    .select("id, user_id, full_name")
    .in("id", [...countByProfessional.keys()])

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  let notified = 0
  for (const professional of professionals ?? []) {
    if (!professional.user_id) continue
    const total = countByProfessional.get(professional.id) ?? 0
    if (total === 0) continue

    const { count: alreadySent } = await admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("user_id", professional.user_id)
      .eq("entity_type", "pending_closures")
      .gte("created_at", startOfToday.toISOString())

    if ((alreadySent ?? 0) > 0) continue

    const { error: notifyError } = await admin.from("notifications").insert({
      clinic_id: clinicId,
      user_id: professional.user_id,
      kind: "agenda",
      title: "Atendimentos aguardando fechamento",
      body: `${total} ${total === 1 ? "consulta já passou" : "consultas já passaram"} e ${
        total === 1 ? "continua" : "continuam"
      } sem marcar se foi atendido ou falta.`,
      href: "/profissional/agenda",
      entity_type: "pending_closures",
    })
    if (notifyError) console.error("pending-closures: notificação falhou", notifyError)
    else notified += 1
  }

  return NextResponse.json({ notified, pending: pending?.length ?? 0 })
}
