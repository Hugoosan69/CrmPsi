import { NextResponse } from "next/server"

import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { fetchWahaQr, getWahaConfig } from "@/services/waha.service"

export const dynamic = "force-dynamic"

/**
 * QR de pareamento do WhatsApp, buscado pelo servidor.
 *
 * Fica em /api/waha e NÃO em /api/integrations de propósito: aquele prefixo está fora do
 * matcher do proxy para o n8n poder consultar sem sessão, e um QR de pareamento ali ficaria
 * público — qualquer pessoa poderia parear o próprio WhatsApp à conta da clínica.
 *
 * O servidor busca no WAHA em vez de o navegador ir direto por duas razões: a chave de API
 * não sai daqui, e o WAHA pode estar numa rede que o navegador do operador não alcança.
 */
export async function GET() {
  const membership = await requirePermission(PERMISSIONS.SETTINGS_MANAGE)
  const supabase = await createClient()
  const config = await getWahaConfig(supabase, membership.clinicId)

  if (!config.baseUrl) {
    return NextResponse.json({ error: "waha_nao_configurado" }, { status: 400 })
  }

  try {
    const png = await fetchWahaQr(config)
    if (!png) {
      // Sem QR normalmente significa que a sessão já está conectada ou ainda subindo —
      // não é erro, e a tela distingue os dois pelo status.
      return NextResponse.json({ error: "qr_indisponivel" }, { status: 404 })
    }

    return new NextResponse(png, {
      headers: {
        "Content-Type": "image/png",
        // O QR muda a cada poucos segundos; cachear mostraria um código já expirado.
        "Cache-Control": "no-store, max-age=0",
      },
    })
  } catch (err) {
    console.error("waha qr falhou", err)
    return NextResponse.json({ error: "waha_inacessivel" }, { status: 502 })
  }
}
