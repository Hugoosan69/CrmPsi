import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/supabase"

type DB = SupabaseClient<Database>

export async function getClinicSummary(supabase: DB, clinicId: string) {
  const [{ count: patients }, { count: professionals }, { count: procedures }] = await Promise.all([
    supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("active", true),
    supabase.from("professionals").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("active", true),
    supabase.from("procedures").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("active", true),
  ])

  return {
    activePatients: patients ?? 0,
    activeProfessionals: professionals ?? 0,
    activeProcedures: procedures ?? 0,
  }
}

/** Recepção view (item 8): today's agenda breakdown, live queue, pending payments. */
export async function getReceptionSummary(supabase: DB, clinicId: string, todayDate: string) {
  const dayStart = `${todayDate}T00:00:00`
  const dayEnd = `${todayDate}T23:59:59.999`

  const [{ data: appointments }, { data: queueEntries }, { data: pendingReceitas }] = await Promise.all([
    supabase
      .from("appointments")
      .select("status")
      .eq("clinic_id", clinicId)
      .gte("scheduled_at", dayStart)
      .lte("scheduled_at", dayEnd),
    supabase
      .from("queue_entries")
      .select("status")
      .eq("clinic_id", clinicId)
      .in("status", ["waiting", "called", "in_service", "paused"]),
    supabase
      .from("financial_transactions")
      .select("amount")
      .eq("clinic_id", clinicId)
      .eq("type", "receita")
      .in("status", ["pendente", "atrasado"]),
  ])

  const appts = appointments ?? []
  return {
    todayTotal: appts.length,
    todayConfirmed: appts.filter((a) => a.status === "confirmed").length,
    waiting: (queueEntries ?? []).filter((q) => q.status === "waiting" || q.status === "called").length,
    inService: (queueEntries ?? []).filter((q) => q.status === "in_service" || q.status === "paused").length,
    pendingPaymentsCount: (pendingReceitas ?? []).length,
    pendingPaymentsTotal: (pendingReceitas ?? []).reduce((sum, t) => sum + Number(t.amount), 0),
  }
}

/** Profissional view (item 13): my day, my queue right now. */
export async function getProfessionalSummary(
  supabase: DB,
  clinicId: string,
  professionalId: string,
  todayDate: string
) {
  const dayStart = `${todayDate}T00:00:00`
  const dayEnd = `${todayDate}T23:59:59.999`

  const [{ data: appointments }, { data: queueEntries }] = await Promise.all([
    supabase
      .from("appointments")
      .select("status")
      .eq("clinic_id", clinicId)
      .eq("professional_id", professionalId)
      .gte("scheduled_at", dayStart)
      .lte("scheduled_at", dayEnd),
    supabase
      .from("queue_entries")
      .select("status")
      .eq("clinic_id", clinicId)
      .eq("professional_id", professionalId)
      .in("status", ["waiting", "called", "in_service", "paused"]),
  ])

  return {
    todayTotal: (appointments ?? []).length,
    todayCompleted: (appointments ?? []).filter((a) => a.status === "completed").length,
    queueWaiting: (queueEntries ?? []).filter((q) => q.status === "waiting" || q.status === "called").length,
    inService: (queueEntries ?? []).some((q) => q.status === "in_service" || q.status === "paused"),
  }
}

/** Gestão view (item 25): faturamento, recebimentos, cancelamentos, faltas. */
export async function getManagementSummary(supabase: DB, clinicId: string, todayDate: string) {
  const monthStart = `${todayDate.slice(0, 7)}-01T00:00:00`

  const [{ data: monthAppointments }, { data: monthTransactions }] = await Promise.all([
    supabase
      .from("appointments")
      .select("status")
      .eq("clinic_id", clinicId)
      .gte("scheduled_at", monthStart),
    supabase
      .from("financial_transactions")
      .select("type,status,amount")
      .eq("clinic_id", clinicId)
      .gte("created_at", monthStart),
  ])

  const appts = monthAppointments ?? []
  const txs = monthTransactions ?? []

  return {
    monthAppointments: appts.length,
    monthCancelled: appts.filter((a) => a.status === "cancelled").length,
    monthNoShow: appts.filter((a) => a.status === "no_show").length,
    monthRevenuePaid: txs
      .filter((t) => t.type === "receita" && t.status === "pago")
      .reduce((sum, t) => sum + Number(t.amount), 0),
    monthRevenuePending: txs
      .filter((t) => t.type === "receita" && (t.status === "pendente" || t.status === "atrasado"))
      .reduce((sum, t) => sum + Number(t.amount), 0),
    monthExpenses: txs
      .filter((t) => t.type === "despesa" && t.status !== "cancelado")
      .reduce((sum, t) => sum + Number(t.amount), 0),
  }
}
