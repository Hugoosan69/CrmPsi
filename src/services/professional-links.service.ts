import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/supabase"
import { fetchPage } from "@/lib/paginated-query"

type DB = SupabaseClient<Database>

// ---------------------------------------------------------------------------
// Consultas — usadas pela página "Meus pacientes" e pelo guard de acesso
// ---------------------------------------------------------------------------

export type LinkedPatient = Database["public"]["Tables"]["patients"]["Row"] & {
  /** Último atendimento concluído com ESTE profissional. */
  lastVisitAt: string | null
  /** Próximo agendamento com ESTE profissional. */
  nextVisitAt: string | null
}

/**
 * Pacientes vinculados a um profissional (via agendamento ou manual).
 *
 * A paginação é opcional: a tela de "Meus pacientes" pagina pela URL, e a busca
 * passa como `search`. O join de agenda é por profissional, não global — o profissional
 * não vê atendimentos de outros colegas.
 */
export async function listLinkedPatients(
  supabase: DB,
  clinicId: string,
  professionalId: string,
  opts: { search?: string; offset?: number; rangeEnd?: number } = {}
): Promise<{ rows: LinkedPatient[]; total: number }> {
  // 1. IDs dos pacientes vinculados a este profissional
  const { data: links, error: linksErr } = await supabase
    .from("professional_patient_links")
    .select("patient_id")
    .eq("clinic_id", clinicId)
    .eq("professional_id", professionalId)
  if (linksErr) throw linksErr

  const patientIds = [...new Set((links ?? []).map((l) => l.patient_id))]
  if (patientIds.length === 0) return { rows: [], total: 0 }

  // 2. Página de pacientes filtrada pelos IDs vinculados
  const { rows: patients, total } = await fetchPage(() => {
    let query = supabase
      .from("patients")
      .select("*", { count: "exact" })
      .eq("clinic_id", clinicId)
      .in("id", patientIds)
      .eq("active", true)

    const search = opts.search?.trim()
    if (search) {
      const digits = search.replace(/\D/g, "")
      const orFilters = [
        `full_name.ilike.%${search}%`,
        `social_name.ilike.%${search}%`,
        `phone.ilike.%${search}%`,
        `whatsapp.ilike.%${search}%`,
      ]
      if (digits) orFilters.push(`cpf.ilike.%${digits}%`)
      query = query.or(orFilters.join(","))
    }

    return query.order("full_name")
  }, opts)

  if (patients.length === 0) return { rows: [], total }

  const pIds = patients.map((p) => p.id)
  const nowIso = new Date().toISOString()

  // 3. Último e próximo atendimento com ESTE profissional
  const [lastVisits, nextVisits] = await Promise.all([
    supabase
      .from("appointments")
      .select("patient_id, scheduled_at")
      .eq("clinic_id", clinicId)
      .eq("professional_id", professionalId)
      .in("patient_id", pIds)
      .eq("status", "completed")
      .order("scheduled_at", { ascending: false })
      .limit(1000),
    supabase
      .from("appointments")
      .select("patient_id, scheduled_at")
      .eq("clinic_id", clinicId)
      .eq("professional_id", professionalId)
      .in("patient_id", pIds)
      .in("status", ["scheduled", "confirmed", "triagem"])
      .gte("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: true })
      .limit(1000),
  ])

  const lastByPatient = new Map<string, string>()
  for (const row of lastVisits.data ?? []) {
    if (!lastByPatient.has(row.patient_id))
      lastByPatient.set(row.patient_id, row.scheduled_at)
  }

  const nextByPatient = new Map<string, string>()
  for (const row of nextVisits.data ?? []) {
    if (!nextByPatient.has(row.patient_id))
      nextByPatient.set(row.patient_id, row.scheduled_at)
  }

  return {
    rows: patients.map((p) => ({
      ...p,
      lastVisitAt: lastByPatient.get(p.id) ?? null,
      nextVisitAt: nextByPatient.get(p.id) ?? null,
    })),
    total,
  }
}

/**
 * Verifica se o profissional tem vínculo com o paciente (para o guard de rota).
 */
export async function hasProfessionalLink(
  supabase: DB,
  clinicId: string,
  professionalId: string,
  patientId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("professional_patient_links")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("professional_id", professionalId)
    .eq("patient_id", patientId)
    .maybeSingle()
  if (error) throw error
  return data !== null
}

// ---------------------------------------------------------------------------
// Escrita — usada pela recepção/gestão para vincular/desvincular manualmente
// ---------------------------------------------------------------------------

export async function linkProfessionalToPatient(
  supabase: DB,
  clinicId: string,
  professionalId: string,
  patientId: string
) {
  const { error } = await supabase
    .from("professional_patient_links")
    .upsert(
      {
        clinic_id: clinicId,
        professional_id: professionalId,
        patient_id: patientId,
        source: "manual",
      },
      { onConflict: "professional_id,patient_id" }
    )
  if (error) throw error
}

export async function unlinkProfessionalFromPatient(
  supabase: DB,
  professionalId: string,
  patientId: string
) {
  const { error } = await supabase
    .from("professional_patient_links")
    .delete()
    .eq("professional_id", professionalId)
    .eq("patient_id", patientId)
  if (error) throw error
}

/**
 * Lista os profissionais vinculados a um paciente (para a aba de vínculos na ficha).
 */
export async function listPatientProfessionalLinks(
  supabase: DB,
  clinicId: string,
  patientId: string
) {
  const { data, error } = await supabase
    .from("professional_patient_links")
    .select("id, professional_id, source, created_at")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: true })
  if (error) throw error
  return data ?? []
}
