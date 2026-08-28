import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Json } from "@/types/supabase"
import { getClinicSettings } from "./clinic-settings.service"
import { stripeEnv } from "@/lib/stripe/env"
import { fromStripeAmount } from "@/config/stripe"

type DB = SupabaseClient<Database>

/**
 * Pagamentos online via Stripe.
 *
 * O que está pronto: receber e conferir webhooks, não processar o mesmo evento duas vezes e
 * quitar um lançamento financeiro a partir de uma cobrança confirmada. O que ainda não
 * existe: criar a cobrança (checkout) e a tela onde a recepção manda o link ao paciente.
 *
 * A ordem é essa de propósito. O webhook é a parte que precisa estar correta desde o
 * primeiro dia — é ele que decide que uma consulta foi paga — e é a única que não dá para
 * corrigir depois sem reprocessar histórico.
 *
 * Credenciais em variáveis de ambiente (lib/stripe/env.ts), não em clinic_settings.
 */

// ---------------------------------------------------------------------------
// Configuração não secreta, por clínica
// ---------------------------------------------------------------------------

export type StripeIntegration = {
  enabled: boolean
  /** ISO 4217, minúsculo — o Stripe rejeita "BRL". */
  currency: string
  /** Descrição que aparece na fatura do cartão do paciente. */
  statementDescriptor: string
}

export const DEFAULT_STRIPE: StripeIntegration = {
  enabled: false,
  currency: "brl",
  statementDescriptor: "",
}

function coerceStripe(raw: unknown): StripeIntegration {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_STRIPE }
  const v = raw as Partial<StripeIntegration>
  return {
    enabled: v.enabled === true,
    currency:
      typeof v.currency === "string" && v.currency
        ? v.currency.toLowerCase()
        : DEFAULT_STRIPE.currency,
    statementDescriptor:
      typeof v.statementDescriptor === "string" ? v.statementDescriptor : "",
  }
}

export async function getStripeIntegration(
  supabase: DB,
  clinicId: string
): Promise<StripeIntegration> {
  const settings = await getClinicSettings(supabase, clinicId)
  const integrations = (settings as { integrations?: { stripe?: unknown } }).integrations
  return coerceStripe(integrations?.stripe)
}

export async function saveStripeIntegration(
  supabase: DB,
  clinicId: string,
  input: StripeIntegration
) {
  const current = await getClinicSettings(supabase, clinicId)
  const integrations = (current as { integrations?: Record<string, unknown> }).integrations ?? {}

  const next = {
    ...current,
    integrations: { ...integrations, stripe: coerceStripe(input) },
  }

  const { error } = await supabase
    .from("clinic_settings")
    .upsert({ clinic_id: clinicId, settings: next as unknown as Json })
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Chamadas à API do Stripe
// ---------------------------------------------------------------------------

const STRIPE_API = "https://api.stripe.com/v1"

/**
 * Uma chamada à API do Stripe, sem SDK.
 *
 * A API é form-encoded, não JSON — mandar `application/json` devolve 400 com uma mensagem
 * que não explica o motivo. Parâmetros aninhados usam colchetes
 * (`metadata[financial_transaction_id]`), e é por isso que o corpo chega de quem chama já
 * como pares planos.
 */
export async function stripeRequest<T>(
  path: string,
  init: {
    method?: "GET" | "POST"
    form?: Record<string, string | number | undefined>
    /** Repassada como Idempotency-Key: o Stripe devolve a mesma resposta em vez de cobrar
     *  duas vezes se a requisição for repetida. */
    idempotencyKey?: string
  } = {}
): Promise<T> {
  const body = init.form
    ? new URLSearchParams(
        Object.entries(init.form)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      )
    : undefined

  const headers: Record<string, string> = {
    Authorization: `Bearer ${stripeEnv.secretKey}`,
  }
  if (body) headers["Content-Type"] = "application/x-www-form-urlencoded"
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey

  const response = await fetch(`${STRIPE_API}${path}`, {
    method: init.method ?? (body ? "POST" : "GET"),
    headers,
    body,
    cache: "no-store",
  })

  const text = await response.text()
  if (!response.ok) {
    // A mensagem do Stripe é específica e útil ("No such customer", "amount must be at
    // least 50"); engoli-la deixaria a depuração cega.
    throw new Error(`Stripe ${response.status}: ${text.slice(0, 400)}`)
  }
  return JSON.parse(text) as T
}

// ---------------------------------------------------------------------------
// Webhook: idempotência e liquidação
// ---------------------------------------------------------------------------

/**
 * Registra o evento e diz se ele é novo.
 *
 * O insert é a própria trava: a chave primária é o id do evento, então a segunda entrega
 * viola a chave e volta como duplicidade. Uma consulta prévia daria falso negativo quando o
 * Stripe reenvia enquanto a primeira entrega ainda está sendo processada — e é justo aí que
 * ele reenvia, porque o que dispara a retentativa é a demora.
 *
 * Precisa do cliente administrativo: `stripe_events` tem RLS ligada e nenhuma policy.
 */
export async function recordStripeEvent(
  admin: DB,
  event: { id: string; type: string; payload: unknown; clinicId?: string | null }
): Promise<{ isNew: boolean }> {
  const { error } = await admin.from("stripe_events").insert({
    id: event.id,
    clinic_id: event.clinicId ?? null,
    type: event.type,
    payload: event.payload as Json,
  })

  if (!error) return { isNew: true }
  // 23505 = unique_violation: já recebido antes.
  if ((error as { code?: string }).code === "23505") return { isNew: false }
  throw error
}

export async function markStripeEventProcessed(
  admin: DB,
  eventId: string,
  failure?: string
) {
  await admin
    .from("stripe_events")
    .update({ processed_at: new Date().toISOString(), error: failure ?? null })
    .eq("id", eventId)
}

/**
 * Quita um lançamento a partir de uma cobrança confirmada.
 *
 * O lançamento é identificado por `metadata.financial_transaction_id`, gravado por nós na
 * criação da cobrança. Sem esse metadado não há como saber a que consulta o dinheiro se
 * refere — o evento fica registrado assim mesmo, e visível como não processado.
 *
 * A duplicidade é barrada pelo índice único de migrations/010, não por uma consulta prévia:
 * duas entregas simultâneas do mesmo evento passariam as duas por um `select` e gravariam
 * dois recebimentos.
 */
export async function settlePaymentFromStripe(
  admin: DB,
  input: {
    clinicId: string
    financialTransactionId: string
    /** Em centavos, como o Stripe manda. */
    amountReceived: number
    /** `pi_...` — a origem do recebimento, e a chave da não-duplicidade. */
    paymentIntentId: string
  }
): Promise<{ settled: boolean; reason?: string }> {
  const { data: method } = await admin
    .from("payment_methods")
    .select("id")
    .eq("clinic_id", input.clinicId)
    .eq("slug", "stripe")
    .maybeSingle()

  if (!method) {
    return {
      settled: false,
      reason: "Forma de pagamento stripe ausente — aplique a migration 010.",
    }
  }

  const { error } = await admin.from("payments").insert({
    clinic_id: input.clinicId,
    financial_transaction_id: input.financialTransactionId,
    payment_method_id: method.id,
    amount: fromStripeAmount(input.amountReceived),
    external_provider: "stripe",
    external_id: input.paymentIntentId,
  })

  if (error) {
    // Recebimento já gravado por uma entrega anterior. Não é falha.
    if ((error as { code?: string }).code === "23505") return { settled: true }
    throw error
  }

  const { error: statusError } = await admin
    .from("financial_transactions")
    .update({ status: "pago" })
    .eq("id", input.financialTransactionId)
    .eq("clinic_id", input.clinicId)
  if (statusError) throw statusError

  return { settled: true }
}
