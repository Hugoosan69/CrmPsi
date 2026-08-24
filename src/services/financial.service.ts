import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, FinancialTransactionStatus, FinancialTransactionType } from "@/types/supabase"

type DB = SupabaseClient<Database>

export type TransactionInput = {
  patient_id?: string | null
  appointment_id?: string | null
  type: FinancialTransactionType
  category?: string | null
  description?: string | null
  amount: number
  due_date?: string | null
}

export async function listPaymentMethods(supabase: DB, clinicId: string) {
  const { data, error } = await supabase
    .from("payment_methods")
    .select("id, name, slug")
    .eq("clinic_id", clinicId)
    .eq("active", true)
    .order("name")
  if (error) throw error
  return data ?? []
}

export type TransactionView = Database["public"]["Tables"]["financial_transactions"]["Row"] & {
  patientName: string | null
}

export async function listTransactions(
  supabase: DB,
  clinicId: string,
  opts: { type?: FinancialTransactionType; status?: FinancialTransactionStatus; patientId?: string } = {}
): Promise<TransactionView[]> {
  let query = supabase
    .from("financial_transactions")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })

  if (opts.type) query = query.eq("type", opts.type)
  if (opts.status) query = query.eq("status", opts.status)
  if (opts.patientId) query = query.eq("patient_id", opts.patientId)

  const { data, error } = await query.limit(200)
  if (error) throw error

  const patientIds = [...new Set((data ?? []).map((t) => t.patient_id).filter(Boolean))] as string[]
  const patientById = new Map<string, string>()
  if (patientIds.length > 0) {
    const { data: patients } = await supabase
      .from("patients")
      .select("id, full_name, social_name")
      .in("id", patientIds)
    for (const p of patients ?? []) patientById.set(p.id, p.social_name || p.full_name)
  }

  return (data ?? []).map((t) => ({ ...t, patientName: t.patient_id ? patientById.get(t.patient_id) ?? null : null }))
}

export async function getTransactionByAppointment(supabase: DB, clinicId: string, appointmentId: string) {
  const { data, error } = await supabase
    .from("financial_transactions")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("appointment_id", appointmentId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getTransaction(supabase: DB, clinicId: string, transactionId: string) {
  const { data, error } = await supabase
    .from("financial_transactions")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("id", transactionId)
    .single()
  if (error) throw error
  return data
}

export async function createTransaction(supabase: DB, clinicId: string, createdBy: string, input: TransactionInput) {
  const { data, error } = await supabase
    .from("financial_transactions")
    .insert({ ...input, clinic_id: clinicId, created_by: createdBy })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

export async function cancelTransaction(supabase: DB, clinicId: string, transactionId: string) {
  const { error } = await supabase
    .from("financial_transactions")
    .update({ status: "cancelado" })
    .eq("clinic_id", clinicId)
    .eq("id", transactionId)
  if (error) throw error
}

export async function listPaymentsForTransaction(supabase: DB, transactionId: string) {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("financial_transaction_id", transactionId)
    .order("paid_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function registerPayment(
  supabase: DB,
  clinicId: string,
  input: { transactionId: string; paymentMethodId: string; amount: number; receivedBy: string; notes?: string | null }
) {
  const { error } = await supabase.from("payments").insert({
    clinic_id: clinicId,
    financial_transaction_id: input.transactionId,
    payment_method_id: input.paymentMethodId,
    amount: input.amount,
    received_by: input.receivedBy,
    notes: input.notes ?? null,
  })
  if (error) throw error

  const [{ data: payments }, transaction] = await Promise.all([
    supabase.from("payments").select("amount").eq("financial_transaction_id", input.transactionId),
    getTransaction(supabase, clinicId, input.transactionId),
  ])
  const totalPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0)

  if (totalPaid >= Number(transaction.amount)) {
    const { error: statusError } = await supabase
      .from("financial_transactions")
      .update({ status: "pago" })
      .eq("clinic_id", clinicId)
      .eq("id", input.transactionId)
    if (statusError) throw statusError
  }
}
