import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/supabase"
import { fetchPage } from "@/lib/paginated-query"

type DB = SupabaseClient<Database>

export type PatientInput = {
  full_name: string
  social_name?: string | null
  cpf?: string | null
  birth_date?: string | null
  sex?: string | null
  phone?: string | null
  whatsapp?: string | null
  email?: string | null
  mother_name?: string | null
  notes?: string | null
}

/**
 * Página de pacientes, com o total para a barra de navegação.
 *
 * Antes devolvia no máximo 50 linhas, sem dizer que havia mais. A recepção que buscasse por
 * um sobrenome comum via a lista parar no meio do alfabeto e não tinha como saber se o
 * paciente não existia ou só não tinha cabido. `count: "exact"` custa uma contagem no banco,
 * e é ela que permite dizer "26–50 de 812" em vez de mentir por omissão.
 */
export async function listPatients(
  supabase: DB,
  clinicId: string,
  opts: {
    search?: string
    activeOnly?: boolean
    offset?: number
    rangeEnd?: number
  } = {}
): Promise<{ rows: Database["public"]["Tables"]["patients"]["Row"][]; total: number }> {
  // Função, não consulta pronta: o construtor do supabase-js muta a si mesmo, então guardar
  // "a versão sem faixa" numa variável não guarda nada. Ver lib/paginated-query.
  const construir = () => {
    let query = supabase
      .from("patients")
      .select("*", { count: "exact" })
      .eq("clinic_id", clinicId)
      .order("full_name")

    if (opts.activeOnly ?? true) {
      query = query.eq("active", true)
    }

    const search = opts.search?.trim()
    if (search) {
      const digits = search.replace(/\D/g, "")
      const orFilters = [
        `full_name.ilike.%${search}%`,
        `phone.ilike.%${search}%`,
        `whatsapp.ilike.%${search}%`,
      ]
      if (digits) orFilters.push(`cpf.ilike.%${digits}%`)
      query = query.or(orFilters.join(","))
    }
    return query
  }

  return fetchPage(construir, opts)
}

export async function getPatient(supabase: DB, clinicId: string, patientId: string) {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("id", patientId)
    .single()
  if (error) throw error
  return data
}

export async function getPatientClinicalInfo(supabase: DB, patientId: string) {
  const { data, error } = await supabase
    .from("patient_clinical_info")
    .select("*")
    .eq("patient_id", patientId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createPatient(
  supabase: DB,
  clinicId: string,
  createdBy: string,
  input: PatientInput
) {
  const { data, error } = await supabase
    .from("patients")
    .insert({ ...input, clinic_id: clinicId, created_by: createdBy })
    .select("id")
    .single()
  if (error) throw error
  return data
}

export async function updatePatient(
  supabase: DB,
  clinicId: string,
  patientId: string,
  input: Partial<PatientInput>
) {
  const { error } = await supabase
    .from("patients")
    .update(input)
    .eq("clinic_id", clinicId)
    .eq("id", patientId)
  if (error) throw error
}

export type PatientClinicalInfoInput = {
  allergies?: string[] | null
  chronic_conditions?: string[] | null
  current_medications?: string[] | null
  relevant_history?: string | null
}

export async function upsertPatientClinicalInfo(
  supabase: DB,
  patientId: string,
  input: PatientClinicalInfoInput
) {
  const { error } = await supabase
    .from("patient_clinical_info")
    .upsert({ patient_id: patientId, ...input })
  if (error) throw error
}

export async function setPatientActive(
  supabase: DB,
  clinicId: string,
  patientId: string,
  active: boolean
) {
  const { error } = await supabase
    .from("patients")
    .update({ active })
    .eq("clinic_id", clinicId)
    .eq("id", patientId)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Listagem enriquecida da tela de Pacientes
// ---------------------------------------------------------------------------

export type PatientStatusFilter = "ativos" | "inativos" | "todos"
export type PatientPackageFilter = "com" | "sem"
export type PatientSort = "nome" | "recentes"

export type PatientWithStats = Database["public"]["Tables"]["patients"]["Row"] & {
  /** Pacotes com saldo em aberto. 0 quando não há nenhum. */
  activePackages: number
  /** Sessões ainda disponíveis somando todos os pacotes ativos. */
  sessionsLeft: number
  /** Último atendimento efetivamente concluído. */
  lastVisitAt: string | null
  /** Próximo horário marcado ainda em aberto. */
  nextVisitAt: string | null
}

export type PatientListFilters = {
  search?: string
  status?: PatientStatusFilter
  /** Só quem tem (ou só quem não tem) pacote com saldo. */
  packages?: PatientPackageFilter
  /** Só quem está sem telefone E sem WhatsApp — não dá para confirmar nem lembrar. */
  missingContact?: boolean
  sort?: PatientSort
  offset?: number
  rangeEnd?: number
}

/** Uuid que não existe: força resultado vazio sem precisar de um caminho especial. */
const NO_MATCH = "00000000-0000-0000-0000-000000000000"

/**
 * Janela das leituras de agenda que alimentam "último" e "próximo" atendimento.
 *
 * Não dá para pedir "o mais recente POR paciente" ao PostgREST sem uma função no banco, e
 * uma consulta por paciente seria um N+1 na tela mais usada da recepção. Em vez disso lê-se
 * uma faixa ordenada e fica-se com a primeira ocorrência de cada paciente. Como a página tem
 * no máximo algumas dezenas de pacientes, só perderia o valor de alguém cujo atendimento
 * mais recente estivesse atrás de outras 3000 linhas mais novas destes mesmos pacientes —
 * o que exigiria centenas de atendimentos por paciente na mesma página.
 */
const AGENDA_SCAN_LIMIT = 3000

/** Primeira ocorrência de cada paciente numa lista já ordenada. */
function firstPerPatient(
  rows: { patient_id: string; scheduled_at: string }[]
): Map<string, string> {
  const out = new Map<string, string>()
  for (const row of rows) {
    if (!out.has(row.patient_id)) out.set(row.patient_id, row.scheduled_at)
  }
  return out
}

/**
 * A listagem da tela de Pacientes: a página de cadastros mais o que a recepção precisa saber
 * antes de abrir a ficha — se há pacote com saldo, quando a pessoa veio pela última vez e
 * quando volta.
 *
 * Filtros que dependem de outra tabela viram uma lista de ids ANTES da consulta principal
 * (mesmo padrão de `financial.service.ts`), e não um recorte depois da paginação: recortar
 * depois deixaria a contagem mentindo e as páginas com tamanhos diferentes.
 */
export async function listPatientsWithStats(
  supabase: DB,
  clinicId: string,
  filters: PatientListFilters = {}
): Promise<{ rows: PatientWithStats[]; total: number }> {
  // ---- Pré-filtro: quem tem pacote com saldo em aberto -------------------
  let packageFilterIds: string[] | null = null
  if (filters.packages) {
    const { data } = await supabase
      .from("patient_packages")
      .select("patient_id")
      .eq("clinic_id", clinicId)
      .eq("status", "active")
    packageFilterIds = [...new Set((data ?? []).map((p) => p.patient_id))]
  }

  const construir = () => {
    let query = supabase
      .from("patients")
      .select("*", { count: "exact" })
      .eq("clinic_id", clinicId)

    const status = filters.status ?? "ativos"
    if (status === "ativos") query = query.eq("active", true)
    if (status === "inativos") query = query.eq("active", false)

    const search = filters.search?.trim()
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

    if (filters.missingContact) {
      // `.or()` sucessivos são combinados com AND: sem telefone E sem whatsapp. String
      // vazia conta como ausente — um campo em branco não serve para contatar ninguém.
      query = query.or("phone.is.null,phone.eq.").or("whatsapp.is.null,whatsapp.eq.")
    }

    if (packageFilterIds) {
      if (filters.packages === "com") {
        query = query.in("id", packageFilterIds.length > 0 ? packageFilterIds : [NO_MATCH])
      } else if (packageFilterIds.length > 0) {
        query = query.not("id", "in", `(${packageFilterIds.join(",")})`)
      }
    }

    return filters.sort === "recentes"
      ? query.order("created_at", { ascending: false })
      : query.order("full_name")
  }

  const { rows: patients, total } = await fetchPage(construir, filters)
  if (patients.length === 0) return { rows: [], total }

  const patientIds = patients.map((p) => p.id)
  const nowIso = new Date().toISOString()

  const [packages, lastVisits, nextVisits] = await Promise.all([
    supabase
      .from("patient_packages")
      .select("patient_id, total_sessions, sessions_used")
      .eq("clinic_id", clinicId)
      .eq("status", "active")
      .in("patient_id", patientIds),
    supabase
      .from("appointments")
      .select("patient_id, scheduled_at")
      .eq("clinic_id", clinicId)
      .in("patient_id", patientIds)
      .eq("status", "completed")
      .order("scheduled_at", { ascending: false })
      .limit(AGENDA_SCAN_LIMIT),
    supabase
      .from("appointments")
      .select("patient_id, scheduled_at")
      .eq("clinic_id", clinicId)
      .in("patient_id", patientIds)
      .in("status", ["scheduled", "confirmed", "triagem"])
      .gte("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: true })
      .limit(AGENDA_SCAN_LIMIT),
  ])

  const packagesByPatient = new Map<string, { count: number; left: number }>()
  for (const pkg of packages.data ?? []) {
    const current = packagesByPatient.get(pkg.patient_id) ?? { count: 0, left: 0 }
    current.count += 1
    current.left += Math.max(0, pkg.total_sessions - pkg.sessions_used)
    packagesByPatient.set(pkg.patient_id, current)
  }

  const lastByPatient = firstPerPatient(lastVisits.data ?? [])
  const nextByPatient = firstPerPatient(nextVisits.data ?? [])

  return {
    rows: patients.map((patient) => {
      const pkg = packagesByPatient.get(patient.id)
      return {
        ...patient,
        activePackages: pkg?.count ?? 0,
        sessionsLeft: pkg?.left ?? 0,
        lastVisitAt: lastByPatient.get(patient.id) ?? null,
        nextVisitAt: nextByPatient.get(patient.id) ?? null,
      }
    }),
    total,
  }
}
