import { NextResponse, type NextRequest } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { verifyStripeSignature } from "@/lib/stripe/signature"
import { stripeEnv, stripeEnvStatus } from "@/lib/stripe/env"
import { isHandledEvent } from "@/config/stripe"
import {
  markStripeEventProcessed,
  recordStripeEvent,
  settlePaymentFromStripe,
} from "@/services/stripe.service"

export const dynamic = "force-dynamic"

/**
 * Webhook do Stripe.
 *
 * É por aqui que a clínica fica sabendo que um pagamento online entrou. A cobrança em si
 * ainda não é criada pelo sistema — este endereço existe antes do resto porque é a peça que
 * não pode nascer errada: um evento processado duas vezes vira dinheiro contado duas vezes,
 * e um evento aceito sem conferir a assinatura deixa qualquer um quitar uma consulta com um
 * POST.
 *
 * Configurar no painel do Stripe (Developers › Webhooks) apontando para
 * https://csibrasilia.club/api/integrations/stripe/webhook e guardar o segredo gerado em
 * STRIPE_WEBHOOK_SECRET.
 *
 * Códigos de resposta importam aqui, porque o Stripe age sobre eles: 2xx encerra a entrega,
 * qualquer outra coisa agenda retentativa com espera crescente por até três dias. Por isso
 * evento desconhecido responde 200 (nunca vamos tratá-lo, reenviar não ajuda) e falha ao
 * gravar responde 500 (queremos a retentativa).
 */

type StripeEvent = {
  id: string
  type: string
  data: { object: Record<string, unknown> }
}

/** `metadata` gravado por nós na criação da cobrança — é o que liga o dinheiro ao lançamento. */
function readMetadata(object: Record<string, unknown>) {
  const metadata = (object.metadata ?? {}) as Record<string, unknown>
  const clinicId = typeof metadata.clinic_id === "string" ? metadata.clinic_id : null
  const financialTransactionId =
    typeof metadata.financial_transaction_id === "string"
      ? metadata.financial_transaction_id
      : null
  return { clinicId, financialTransactionId }
}

export async function POST(request: NextRequest) {
  if (!stripeEnvStatus().webhookSecret) {
    // 503 e não 500: a integração não está configurada, o que é um estado legítimo enquanto
    // os pagamentos online não entram no ar.
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET não configurado." },
      { status: 503 }
    )
  }

  // Corpo CRU, obrigatoriamente. A assinatura cobre os bytes exatos que o Stripe enviou —
  // um JSON.parse seguido de stringify reordena chaves e invalida a conferência.
  const rawBody = await request.text()

  const verification = verifyStripeSignature({
    rawBody,
    header: request.headers.get("stripe-signature"),
    secret: stripeEnv.webhookSecret,
  })
  if (!verification.ok) {
    return NextResponse.json({ error: verification.reason }, { status: 400 })
  }

  let event: StripeEvent
  try {
    event = JSON.parse(rawBody) as StripeEvent
  } catch {
    return NextResponse.json({ error: "corpo não é JSON válido" }, { status: 400 })
  }
  if (!event?.id || !event?.type) {
    return NextResponse.json({ error: "evento sem id ou type" }, { status: 400 })
  }

  const object = event.data?.object ?? {}
  const { clinicId, financialTransactionId } = readMetadata(object)

  const admin = createAdminClient()

  let isNew: boolean
  try {
    ;({ isNew } = await recordStripeEvent(admin, {
      id: event.id,
      type: event.type,
      payload: event,
      clinicId,
    }))
  } catch (err) {
    console.error("stripe webhook: falha ao registrar evento", event.id, err)
    // 500 pede retentativa: perder o registro é pior que processar de novo, e a chave
    // primária impede a duplicidade quando ele voltar.
    return NextResponse.json({ error: "falha ao registrar evento" }, { status: 500 })
  }

  // Reentrega do que já foi tratado. 200 sem refazer nada.
  if (!isNew) return NextResponse.json({ received: true, duplicate: true })

  if (!isHandledEvent(event.type)) {
    await markStripeEventProcessed(admin, event.id, "tipo não tratado")
    return NextResponse.json({ received: true, handled: false })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "payment_intent.succeeded": {
        if (!clinicId || !financialTransactionId) {
          await markStripeEventProcessed(
            admin,
            event.id,
            "metadata sem clinic_id/financial_transaction_id"
          )
          // 200: o evento chegou íntegro, o defeito está em quem criou a cobrança sem os
          // metadados. Reenviar produziria o mesmo resultado.
          return NextResponse.json({ received: true, handled: false })
        }

        // `payment_intent` é uma string na sessão de checkout e o próprio id no
        // payment_intent.succeeded.
        const paymentIntentId =
          typeof object.payment_intent === "string"
            ? object.payment_intent
            : typeof object.id === "string"
              ? object.id
              : null

        const amount =
          typeof object.amount_received === "number"
            ? object.amount_received
            : typeof object.amount_total === "number"
              ? object.amount_total
              : null

        if (!paymentIntentId || amount === null) {
          await markStripeEventProcessed(admin, event.id, "evento sem valor ou payment_intent")
          return NextResponse.json({ received: true, handled: false })
        }

        const result = await settlePaymentFromStripe(admin, {
          clinicId,
          financialTransactionId,
          amountReceived: amount,
          paymentIntentId,
        })

        await markStripeEventProcessed(admin, event.id, result.reason)
        return NextResponse.json({ received: true, settled: result.settled })
      }

      case "payment_intent.payment_failed":
      case "charge.refunded": {
        // Registrados e visíveis, sem efeito no financeiro por enquanto. Estornar um
        // recebimento e reabrir o lançamento é uma decisão de caixa que a clínica ainda não
        // definiu — e inventá-la aqui alteraria fechamento de dia sem ninguém pedir.
        await markStripeEventProcessed(admin, event.id, "registrado sem efeito no financeiro")
        return NextResponse.json({ received: true, handled: false })
      }
    }
  } catch (err) {
    console.error("stripe webhook: falha ao processar", event.id, err)
    await markStripeEventProcessed(
      admin,
      event.id,
      err instanceof Error ? err.message : "erro desconhecido"
    )
    return NextResponse.json({ error: "falha ao processar evento" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
