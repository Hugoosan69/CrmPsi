import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, FinancialTransactionStatus, FinancialTransactionType } from "@/types/supabase"
import { packageLinks } from "./financial.service"
import { guidesByAppointment } from "./billing.service"

type DB = SupabaseClient<Database>

export type TransactionDetail = {
  id: string
  /** Rótulo já resolvido — nome ATUAL do pacote quando a linha é de pacote. */
  title: string
  category: string | null
  description: string | null
  type: FinancialTransactionType
  status: FinancialTransactionStatus
  amount: number
  dueDate: string | null
  createdAt: string
  createdByName: string | null
  patient: { id: string; name: string } | null
  appointment: {
    id: string
    scheduledAt: string
    durationMinutes: number
    status: string
    professionalName: string | null
    procedureName: string | null
  } | null
  /** Qual sessão de qual pacote este lançamento consumiu. */
  packageSession: {
    packageName: string
    specialtyName: string | null
    sessionNumber: number
    totalSessions: number
    sessionsUsed: number
    sessionStatus: string
    billingMode: string
    /** O que a sessão deve lançar segundo o modo — para conferir com o valor real. */
    expectedAmount: number
  } | null
  /** Guia de convênio deste atendimento — número, convênio e o que ele paga. */
  guide: {
    guideNumber: string | null
    insurerName: string
    amount: number
    status: string
    attachmentUrl: string | null
  } | null
  /** Venda de pacote: a linha É a compra do saldo. */
  packageSale: {
    packageName: string
    totalSessions: number
    sessionsUsed: number
    billingMode: string
  } | null
  payments: {
    id: string
    amount: number
    paidAt: string
    methodName: string | null
    receivedByName: string | null
    notes: string | null
  }[]
  /** Correções de valor já feitas nesta linha, lidas da trilha de auditoria. */
  amountChanges: { at: string; byName: string | null; from: number | null; to: number | null }[]
}

/** Nome de exibição de perfis, por id. */
async function profileNames(supabase: DB, ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  if (unique.length === 0) return new Map()
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", unique)
  return new Map((data ?? []).map((p) => [p.id, p.full_name]))
}

/** `before`/`after` da auditoria são Json livre; só interessa o campo `amount`. */
function amountFrom(value: unknown): number | null {
  if (value && typeof value === "object" && "amount" in value) {
    const raw = (value as { amount?: unknown }).amount
    if (typeof raw === "number") return raw
    if (typeof raw === "string" && raw.trim() !== "") {
      const parsed = Number(raw)
      return Number.isFinite(parsed) ? parsed : null
    }
  }
  return null
}

/**
 * Tudo que explica um lançamento: de onde veio, qual atendimento o gerou, qual sessão de
 * qual pacote ele consumiu, como foi recebido e o que já foi corrigido nele.
 *
 * A pergunta que motivou a tela é "R$ 0,00, por quê?" — e responder exige juntar tabelas
 * que a lista não mostra. Fica num arquivo à parte porque é uma leitura pesada de uma linha
 * só, o oposto de `listTransactions`, que é leve e de muitas.
 *
 * Tudo por leitura explícita: `src/types/supabase.ts` é escrito à mão com
 * `Relationships: []`, então embed aqui não teria tipagem nenhuma.
 */
export async function getTransactionDetail(
  supabase: DB,
  clinicId: string,
  transactionId: string
): Promise<TransactionDetail | null> {
  const { data: tx, error } = await supabase
    .from("financial_transactions")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("id", transactionId)
    .maybeSingle()
  if (error) throw error
  if (!tx) return null

  const link = (await packageLinks(supabase, clinicId)).get(tx.id) ?? null

  const [{ data: patient }, { data: appointment }] = await Promise.all([
    tx.patient_id
      ? supabase
          .from("patients")
          .select("id, full_name, social_name")
          .eq("id", tx.patient_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    tx.appointment_id
      ? supabase
          .from("appointments")
          .select("id, scheduled_at, duration_minutes, status, professional_id, procedure_id")
          .eq("clinic_id", clinicId)
          .eq("id", tx.appointment_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const [{ data: professional }, { data: procedure }] = await Promise.all([
    appointment?.professional_id
      ? supabase
          .from("professionals")
          .select("full_name")
          .eq("id", appointment.professional_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    appointment?.procedure_id
      ? supabase.from("procedures").select("name").eq("id", appointment.procedure_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const [{ data: paymentRows }, { data: methods }, { data: auditRows }] = await Promise.all([
    supabase
      .from("payments")
      .select("id, amount, paid_at, payment_method_id, received_by, notes")
      .eq("clinic_id", clinicId)
      .eq("financial_transaction_id", tx.id)
      .order("paid_at", { ascending: true }),
    supabase.from("payment_methods").select("id, name").eq("clinic_id", clinicId),
    supabase
      .from("audit_logs")
      .select("created_at, user_id, action, before, after")
      .eq("clinic_id", clinicId)
      .eq("entity_type", "financial_transaction")
      .eq("entity_id", tx.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ])

  const methodById = new Map((methods ?? []).map((m) => [m.id, m.name]))
  const nameById = await profileNames(supabase, [
    tx.created_by,
    ...(paymentRows ?? []).map((p) => p.received_by),
    ...(auditRows ?? []).map((a) => a.user_id),
  ])

  const amountChanges = (auditRows ?? [])
    .filter((a) => a.action.includes("amount"))
    .map((a) => ({
      at: a.created_at,
      byName: a.user_id ? nameById.get(a.user_id) ?? null : null,
      from: amountFrom(a.before),
      to: amountFrom(a.after),
    }))

  // --- guia de convênio ---------------------------------------------------
  const guias = tx.appointment_id
    ? await guidesByAppointment(supabase, clinicId, [tx.appointment_id])
    : new Map()
  const guiaDoAtendimento = tx.appointment_id ? guias.get(tx.appointment_id) ?? null : null

  // --- sessão de pacote consumida ----------------------------------------
  let packageSession: TransactionDetail["packageSession"] = null
  let packageSale: TransactionDetail["packageSale"] = null

  if (link?.kind === "sessao" && tx.appointment_id) {
    const { data: session } = await supabase
      .from("patient_package_sessions")
      .select("patient_package_id, session_number, status")
      .eq("appointment_id", tx.appointment_id)
      .maybeSingle()

    if (session) {
      const { data: balance } = await supabase
        .from("patient_packages")
        .select("total_sessions, sessions_used, total_price, session_package_id")
        .eq("clinic_id", clinicId)
        .eq("id", session.patient_package_id)
        .maybeSingle()

      if (balance) {
        const { data: catalog } = await supabase
          .from("session_packages")
          .select("billing_mode, specialty_id")
          .eq("id", balance.session_package_id)
          .maybeSingle()

        const { data: specialty } = catalog?.specialty_id
          ? await supabase
              .from("specialties")
              .select("name")
              .eq("id", catalog.specialty_id)
              .maybeSingle()
          : { data: null }

        const billingMode = catalog?.billing_mode ?? "unico"
        packageSession = {
          packageName: link.packageName,
          specialtyName: specialty?.name ?? null,
          sessionNumber: session.session_number,
          totalSessions: balance.total_sessions,
          sessionsUsed: balance.sessions_used,
          sessionStatus: session.status,
          billingMode,
          expectedAmount:
            billingMode === "por_sessao" && balance.total_sessions > 0
              ? Math.round((Number(balance.total_price) / balance.total_sessions) * 100) / 100
              : 0,
        }
      }
    }
  }

  if (link?.kind === "venda") {
    const { data: balance } = await supabase
      .from("patient_packages")
      .select("total_sessions, sessions_used, session_package_id")
      .eq("clinic_id", clinicId)
      .eq("financial_transaction_id", tx.id)
      .maybeSingle()

    if (balance) {
      const { data: catalog } = await supabase
        .from("session_packages")
        .select("billing_mode")
        .eq("id", balance.session_package_id)
        .maybeSingle()

      packageSale = {
        packageName: link.packageName,
        totalSessions: balance.total_sessions,
        sessionsUsed: balance.sessions_used,
        billingMode: catalog?.billing_mode ?? "unico",
      }
    }
  }

  return {
    id: tx.id,
    title: link
      ? `${link.kind === "venda" ? "Venda de pacote" : "Sessão de pacote"} — ${link.packageName}`
      : procedure?.name
        ? `Atendimento — ${procedure.name}`
        : tx.description || tx.category || "Lançamento",
    category: tx.category,
    description: tx.description,
    type: tx.type,
    status: tx.status,
    amount: Number(tx.amount),
    dueDate: tx.due_date,
    createdAt: tx.created_at,
    createdByName: tx.created_by ? nameById.get(tx.created_by) ?? null : null,
    patient: patient ? { id: patient.id, name: patient.social_name || patient.full_name } : null,
    appointment: appointment
      ? {
          id: appointment.id,
          scheduledAt: appointment.scheduled_at,
          durationMinutes: appointment.duration_minutes,
          status: appointment.status,
          professionalName: professional?.full_name ?? null,
          procedureName: procedure?.name ?? null,
        }
      : null,
    guide: guiaDoAtendimento
      ? {
          guideNumber: guiaDoAtendimento.guideNumber,
          insurerName: guiaDoAtendimento.insurerName,
          amount: guiaDoAtendimento.amount,
          status: guiaDoAtendimento.status,
          attachmentUrl: guiaDoAtendimento.attachmentUrl,
        }
      : null,
    packageSession,
    packageSale,
    payments: (paymentRows ?? []).map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      paidAt: p.paid_at,
      methodName: p.payment_method_id ? methodById.get(p.payment_method_id) ?? null : null,
      receivedByName: p.received_by ? nameById.get(p.received_by) ?? null : null,
      notes: p.notes,
    })),
    amountChanges,
  }
}
