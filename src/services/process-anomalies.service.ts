import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/supabase"
import { toClinicDate, todaySaoPauloDate } from "@/utils/datetime"

type DB = SupabaseClient<Database>

/**
 * Varredura de consistência operacional: tudo que o sistema consegue provar que está fora
 * do esperado, em qualquer domínio — fila, agenda, financeiro, pacotes e cadastro.
 *
 * Duas regras de projeto, ambas aprendidas na primeira versão desta tela:
 *
 * 1. **Nenhum embed do PostgREST.** `src/types/supabase.ts` é escrito à mão com
 *    `Relationships: []`, então `select("a, b:tabela(...)")` não recebe tipagem nenhuma e
 *    só compila via `any` — e, pior, a direção do embed (objeto para FK direta, lista para
 *    reversa) passa despercebida e o filtro erra em silêncio. Aqui é tudo leitura indexada
 *    explícita, como em `notifications.service.ts` e `queue.service.ts`.
 *
 * 2. **Só anomalia que o sistema consegue provar.** Um agendamento pré-pago para semana que
 *    vem não tem entrada na fila e isso está *certo* — o paciente ainda não chegou. O sinal
 *    real de "pago e não mandado para o profissional" é a entrada parada em `released`, que
 *    é literalmente o estado "pagamento confirmado, aguardando envio para a fila"
 *    (database/migrations/001).
 */

export type AnomalySeverity = "critical" | "warning" | "info"
export type AnomalyDomain = "fila" | "agenda" | "financeiro" | "pacotes" | "cadastro"

export type AnomalyItem = {
  /** Estável por linha de origem — serve de key no React e de âncora para auditoria. */
  id: string
  /** Quem é o caso: nome do paciente, do profissional, descrição do lançamento. */
  subject: string
  /** O que exatamente está fora do esperado neste caso. */
  detail: string
  /** Quando o problema começou a contar, quando isso faz sentido. */
  since: string | null
  /** Valor envolvido, em reais (numeric(10,2) — NÃO centavos). */
  amount: number | null
  /** Para onde ir para resolver. Sempre uma rota que existe. */
  href: string | null
}

export type AnomalyGroup = {
  key: string
  domain: AnomalyDomain
  severity: AnomalySeverity
  /** O que está errado, em uma linha. */
  title: string
  /** Por que importa e o que fazer — o operador não deveria ter de deduzir. */
  explanation: string
  items: AnomalyItem[]
}

/** Minutos que uma entrada pode ficar em `released` antes de virar anomalia. */
const RELEASED_STALE_MINUTES = 10
/** Minutos de espera na fila a partir dos quais o caso é reportado. */
const WAITING_STALE_MINUTES = 45
/** Horas de atendimento em curso a partir das quais a sessão parece esquecida aberta. */
const IN_SERVICE_STALE_HOURS = 4
/** Horas depois do horário marcado em que um agendamento sem desfecho vira anomalia. */
const APPOINTMENT_OVERDUE_HOURS = 2
/** Teto por verificação: a tela é um painel de triagem, não um relatório completo. */
const SCAN_LIMIT = 200

function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
}

function humanDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)} dia(s)`
}

/** Nome de exibição do paciente (social tem precedência), por id. */
async function patientNames(supabase: DB, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return new Map()
  const { data } = await supabase
    .from("patients")
    .select("id, full_name, social_name")
    .in("id", unique)
  return new Map((data ?? []).map((p) => [p.id, p.social_name || p.full_name]))
}

async function professionalNames(supabase: DB, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return new Map()
  const { data } = await supabase.from("professionals").select("id, full_name").in("id", unique)
  return new Map((data ?? []).map((p) => [p.id, p.full_name]))
}

/**
 * Cada verificação devolve um grupo ou `null` (nada errado). Erros nunca derrubam a tela
 * inteira: uma tabela que ainda não existe no banco (pacotes, por exemplo) só significa que
 * aquela verificação não tem o que dizer.
 */
type Check = (supabase: DB, clinicId: string) => Promise<AnomalyGroup | null>

function group(
  base: Omit<AnomalyGroup, "items">,
  items: AnomalyItem[]
): AnomalyGroup | null {
  return items.length > 0 ? { ...base, items } : null
}

// ---------------------------------------------------------------------------
// FILA
// ---------------------------------------------------------------------------

/**
 * A anomalia relatada pela clínica: "muito atendimento com pagamento confirmado sem ser
 * enviado para a fila do profissional". `released` é exatamente esse estado — pago, à
 * espera do clique "Enviar para fila" na recepção. Parado, o paciente fica sentado sem que
 * profissional nenhum o enxergue.
 */
const releasedNotSent: Check = async (supabase, clinicId) => {
  const { data } = await supabase
    .from("queue_entries")
    .select("id, patient_id, professional_id, financial_transaction_id, updated_at, arrived_at")
    .eq("clinic_id", clinicId)
    .eq("status", "released")
    .limit(SCAN_LIMIT)

  const stale = (data ?? []).filter(
    (e) => minutesSince(e.updated_at ?? e.arrived_at) >= RELEASED_STALE_MINUTES
  )
  if (stale.length === 0) return null

  const [names, profs, charges] = await Promise.all([
    patientNames(supabase, stale.map((e) => e.patient_id)),
    professionalNames(supabase, stale.map((e) => e.professional_id).filter((v): v is string => Boolean(v))),
    (async () => {
      const ids = stale.map((e) => e.financial_transaction_id).filter((v): v is string => Boolean(v))
      if (ids.length === 0) return new Map<string, number>()
      const { data: tx } = await supabase
        .from("financial_transactions")
        .select("id, amount")
        .in("id", [...new Set(ids)])
      return new Map((tx ?? []).map((t) => [t.id, Number(t.amount)]))
    })(),
  ])

  return group(
    {
      key: "released-not-sent",
      domain: "fila",
      severity: "critical",
      title: "Pagamento confirmado, mas não enviado para a fila",
      explanation:
        "O pagamento já está confirmado e o paciente está parado antes da fila — nenhum profissional o enxerga. Abra a Fila e use “Enviar para fila”.",
    },
    stale.map((e) => {
      const waited = minutesSince(e.updated_at ?? e.arrived_at)
      const prof = e.professional_id ? profs.get(e.professional_id) : null
      return {
        id: e.id,
        subject: names.get(e.patient_id) ?? "Paciente",
        detail: `Liberado há ${humanDuration(waited)}${prof ? ` · ${prof}` : " · sem profissional definido"}`,
        since: e.updated_at ?? e.arrived_at,
        amount: e.financial_transaction_id ? charges.get(e.financial_transaction_id) ?? null : null,
        href: "/recepcao/fila",
      }
    })
  )
}

/**
 * O inverso: a entrada continua barrada em `payment_pending` embora a cobrança vinculada já
 * esteja `pago`. Significa que o pagamento foi registrado por um caminho que não chamou
 * `markQueueEntriesReleasedForTransaction` — o paciente pagou e continua bloqueado.
 */
const paidButStillGated: Check = async (supabase, clinicId) => {
  const { data } = await supabase
    .from("queue_entries")
    .select("id, patient_id, financial_transaction_id, arrived_at")
    .eq("clinic_id", clinicId)
    .eq("status", "payment_pending")
    .not("financial_transaction_id", "is", null)
    .limit(SCAN_LIMIT)

  const entries = data ?? []
  if (entries.length === 0) return null

  const txIds = entries.map((e) => e.financial_transaction_id).filter((v): v is string => Boolean(v))
  const { data: paid } = await supabase
    .from("financial_transactions")
    .select("id, amount")
    .in("id", [...new Set(txIds)])
    .eq("status", "pago")

  const paidById = new Map((paid ?? []).map((t) => [t.id, Number(t.amount)]))
  const stuck = entries.filter(
    (e) => e.financial_transaction_id && paidById.has(e.financial_transaction_id)
  )
  if (stuck.length === 0) return null

  const names = await patientNames(supabase, stuck.map((e) => e.patient_id))

  return group(
    {
      key: "paid-but-gated",
      domain: "fila",
      severity: "critical",
      title: "Cobrança paga, mas o paciente continua barrado no caixa",
      explanation:
        "A cobrança está quitada e a entrada continua em “pagamento pendente”. O pagamento foi registrado por fora do fluxo da fila. Registre a liberação na Fila para destravar.",
    },
    stuck.map((e) => ({
      id: e.id,
      subject: names.get(e.patient_id) ?? "Paciente",
      detail: `Aguardando desde ${new Date(e.arrived_at).toLocaleString("pt-BR")}`,
      since: e.arrived_at,
      amount: e.financial_transaction_id ? paidById.get(e.financial_transaction_id) ?? null : null,
      href: "/recepcao/fila",
    }))
  )
}

/** Entrada viva na fila cujo agendamento já foi encerrado — a fila não foi limpa. */
const orphanQueueEntries: Check = async (supabase, clinicId) => {
  const { data } = await supabase
    .from("queue_entries")
    .select("id, patient_id, appointment_id, status, arrived_at")
    .eq("clinic_id", clinicId)
    .in("status", ["payment_pending", "released", "waiting", "called", "in_service", "paused"])
    .not("appointment_id", "is", null)
    .limit(SCAN_LIMIT)

  const entries = data ?? []
  if (entries.length === 0) return null

  const apptIds = entries.map((e) => e.appointment_id).filter((v): v is string => Boolean(v))
  const { data: closed } = await supabase
    .from("appointments")
    .select("id, status")
    .in("id", [...new Set(apptIds)])
    .in("status", ["completed", "cancelled", "no_show"])

  const closedById = new Map((closed ?? []).map((a) => [a.id, a.status]))
  const orphans = entries.filter((e) => e.appointment_id && closedById.has(e.appointment_id))
  if (orphans.length === 0) return null

  const names = await patientNames(supabase, orphans.map((e) => e.patient_id))
  const STATUS_PT: Record<string, string> = {
    completed: "concluído",
    cancelled: "cancelado",
    no_show: "falta",
  }

  return group(
    {
      key: "orphan-queue",
      domain: "fila",
      severity: "warning",
      title: "Paciente ainda na fila com o atendimento já encerrado",
      explanation:
        "O agendamento foi concluído, cancelado ou marcado como falta, mas a entrada continua viva na fila e polui o painel do profissional.",
    },
    orphans.map((e) => ({
      id: e.id,
      subject: names.get(e.patient_id) ?? "Paciente",
      detail: `Agendamento ${STATUS_PT[closedById.get(e.appointment_id!) ?? ""] ?? "encerrado"} · fila em “${e.status}”`,
      since: e.arrived_at,
      amount: null,
      href: "/recepcao/fila",
    }))
  )
}

/** Espera longa demais: alguém foi esquecido no painel. */
const longWait: Check = async (supabase, clinicId) => {
  const { data } = await supabase
    .from("queue_entries")
    .select("id, patient_id, professional_id, arrived_at")
    .eq("clinic_id", clinicId)
    .eq("status", "waiting")
    .limit(SCAN_LIMIT)

  const stale = (data ?? []).filter((e) => minutesSince(e.arrived_at) >= WAITING_STALE_MINUTES)
  if (stale.length === 0) return null

  const [names, profs] = await Promise.all([
    patientNames(supabase, stale.map((e) => e.patient_id)),
    professionalNames(supabase, stale.map((e) => e.professional_id).filter((v): v is string => Boolean(v))),
  ])

  return group(
    {
      key: "long-wait",
      domain: "fila",
      severity: "warning",
      title: "Paciente aguardando há muito tempo",
      explanation: `Na fila há mais de ${WAITING_STALE_MINUTES} minutos sem ser chamado.`,
    },
    stale.map((e) => ({
      id: e.id,
      subject: names.get(e.patient_id) ?? "Paciente",
      detail: `Esperando há ${humanDuration(minutesSince(e.arrived_at))}${
        e.professional_id ? ` · ${profs.get(e.professional_id) ?? ""}` : ""
      }`,
      since: e.arrived_at,
      amount: null,
      href: "/recepcao/fila",
    }))
  )
}

/** Atendimento em curso há horas: quase sempre um cronômetro que ninguém encerrou. */
const openTooLong: Check = async (supabase, clinicId) => {
  const { data } = await supabase
    .from("queue_entries")
    .select("id, patient_id, professional_id, service_started_at")
    .eq("clinic_id", clinicId)
    .in("status", ["in_service", "paused"])
    .not("service_started_at", "is", null)
    .limit(SCAN_LIMIT)

  const stale = (data ?? []).filter(
    (e) => e.service_started_at && minutesSince(e.service_started_at) >= IN_SERVICE_STALE_HOURS * 60
  )
  if (stale.length === 0) return null

  const [names, profs] = await Promise.all([
    patientNames(supabase, stale.map((e) => e.patient_id)),
    professionalNames(supabase, stale.map((e) => e.professional_id).filter((v): v is string => Boolean(v))),
  ])

  return group(
    {
      key: "open-too-long",
      domain: "fila",
      severity: "warning",
      title: "Atendimento aberto há horas",
      explanation:
        "O cronômetro segue correndo. Se o atendimento já terminou, encerre-o — o tempo registrado alimenta os relatórios de produtividade.",
    },
    stale.map((e) => ({
      id: e.id,
      subject: names.get(e.patient_id) ?? "Paciente",
      detail: `Aberto há ${humanDuration(minutesSince(e.service_started_at!))}${
        e.professional_id ? ` · ${profs.get(e.professional_id) ?? ""}` : ""
      }`,
      since: e.service_started_at,
      amount: null,
      href: "/recepcao/fila",
    }))
  )
}

// ---------------------------------------------------------------------------
// AGENDA
// ---------------------------------------------------------------------------

/** Horário já passou e o agendamento continua em aberto: ninguém deu o desfecho. */
const appointmentsWithoutOutcome: Check = async (supabase, clinicId) => {
  const cutoff = new Date(Date.now() - APPOINTMENT_OVERDUE_HOURS * 3600_000).toISOString()
  const { data } = await supabase
    .from("appointments")
    .select("id, patient_id, professional_id, scheduled_at, status")
    .eq("clinic_id", clinicId)
    .in("status", ["scheduled", "confirmed", "triagem"])
    .lt("scheduled_at", cutoff)
    .order("scheduled_at", { ascending: false })
    .limit(SCAN_LIMIT)

  const rows = data ?? []
  if (rows.length === 0) return null

  const [names, profs] = await Promise.all([
    patientNames(supabase, rows.map((a) => a.patient_id)),
    professionalNames(supabase, rows.map((a) => a.professional_id)),
  ])

  return group(
    {
      key: "appointment-no-outcome",
      domain: "agenda",
      severity: "warning",
      title: "Atendimento passado sem desfecho",
      explanation:
        "O horário já passou e o agendamento continua marcado como agendado, confirmado ou triagem. Sem desfecho ele não conta como atendido nem como falta, e distorce ocupação e faturamento.",
    },
    rows.map((a) => ({
      id: a.id,
      subject: names.get(a.patient_id) ?? "Paciente",
      detail: `${new Date(a.scheduled_at).toLocaleString("pt-BR")} · ${profs.get(a.professional_id) ?? "—"} · situação “${a.status}”`,
      since: a.scheduled_at,
      amount: null,
      href: `/recepcao/agenda?data=${toClinicDate(a.scheduled_at)}`,
    }))
  )
}

/** Check-in registrado, mas nenhuma entrada de fila foi criada: o paciente sumiu do fluxo. */
const checkedInWithoutQueue: Check = async (supabase, clinicId) => {
  const { data } = await supabase
    .from("appointments")
    .select("id, patient_id, professional_id, checked_in_at")
    .eq("clinic_id", clinicId)
    .not("checked_in_at", "is", null)
    .in("status", ["scheduled", "confirmed", "triagem"])
    .order("checked_in_at", { ascending: false })
    .limit(SCAN_LIMIT)

  const rows = data ?? []
  if (rows.length === 0) return null

  const { data: queued } = await supabase
    .from("queue_entries")
    .select("appointment_id")
    .eq("clinic_id", clinicId)
    .in("appointment_id", rows.map((a) => a.id))

  const hasQueue = new Set((queued ?? []).map((q) => q.appointment_id).filter(Boolean))
  const missing = rows.filter((a) => !hasQueue.has(a.id))
  if (missing.length === 0) return null

  const [names, profs] = await Promise.all([
    patientNames(supabase, missing.map((a) => a.patient_id)),
    professionalNames(supabase, missing.map((a) => a.professional_id)),
  ])

  return group(
    {
      key: "checkin-without-queue",
      domain: "agenda",
      severity: "critical",
      title: "Check-in feito sem entrada na fila",
      explanation:
        "O paciente foi registrado como presente, mas não existe entrada na fila para ele. Ele não aparece para ninguém — refaça o check-in.",
    },
    missing.map((a) => ({
      id: a.id,
      subject: names.get(a.patient_id) ?? "Paciente",
      detail: `Check-in em ${new Date(a.checked_in_at!).toLocaleString("pt-BR")} · ${profs.get(a.professional_id) ?? "—"}`,
      since: a.checked_in_at,
      amount: null,
      href: `/recepcao/agenda?data=${toClinicDate(a.checked_in_at!)}`,
    }))
  )
}

// ---------------------------------------------------------------------------
// FINANCEIRO
// ---------------------------------------------------------------------------

/** Vencido e ainda marcado como pendente: o status nunca virou `atrasado`. */
const overdueStillPending: Check = async (supabase, clinicId) => {
  const today = todaySaoPauloDate()
  const { data } = await supabase
    .from("financial_transactions")
    .select("id, description, category, amount, due_date, patient_id")
    .eq("clinic_id", clinicId)
    .eq("status", "pendente")
    .not("due_date", "is", null)
    .lt("due_date", today)
    .order("due_date", { ascending: true })
    .limit(SCAN_LIMIT)

  const rows = data ?? []
  if (rows.length === 0) return null

  const names = await patientNames(
    supabase,
    rows.map((t) => t.patient_id).filter((v): v is string => Boolean(v))
  )

  return group(
    {
      key: "overdue-pending",
      domain: "financeiro",
      severity: "warning",
      title: "Cobrança vencida ainda como pendente",
      explanation:
        "A data de vencimento passou e o lançamento continua “pendente” em vez de “atrasado”. Enquanto ficar assim, ele não aparece na régua de cobrança.",
    },
    rows.map((t) => ({
      id: t.id,
      subject: (t.patient_id ? names.get(t.patient_id) : null) ?? t.description ?? t.category ?? "Lançamento",
      detail: `Venceu em ${new Date(`${t.due_date}T12:00:00`).toLocaleDateString("pt-BR")}`,
      since: t.due_date,
      amount: Number(t.amount),
      href: "/gestao/financeiro?aba=pendentes",
    }))
  )
}

/** Atendimento concluído sem nenhuma cobrança vinculada: receita que se perdeu no caminho. */
const completedWithoutCharge: Check = async (supabase, clinicId) => {
  const { data } = await supabase
    .from("appointments")
    .select("id, patient_id, professional_id, scheduled_at, patient_package_session_id")
    .eq("clinic_id", clinicId)
    .eq("status", "completed")
    .order("scheduled_at", { ascending: false })
    .limit(SCAN_LIMIT)

  // Sessão de pacote é cobrada na venda do pacote — ausência de lançamento é o esperado.
  const rows = (data ?? []).filter((a) => !a.patient_package_session_id)
  if (rows.length === 0) return null

  const { data: charged } = await supabase
    .from("financial_transactions")
    .select("appointment_id")
    .eq("clinic_id", clinicId)
    .in("appointment_id", rows.map((a) => a.id))
    .neq("status", "cancelado")

  const hasCharge = new Set((charged ?? []).map((t) => t.appointment_id).filter(Boolean))
  const missing = rows.filter((a) => !hasCharge.has(a.id))
  if (missing.length === 0) return null

  const [names, profs] = await Promise.all([
    patientNames(supabase, missing.map((a) => a.patient_id)),
    professionalNames(supabase, missing.map((a) => a.professional_id)),
  ])

  return group(
    {
      key: "completed-without-charge",
      domain: "financeiro",
      severity: "warning",
      title: "Atendimento concluído sem cobrança",
      explanation:
        "O atendimento foi concluído e não existe lançamento financeiro para ele. Não é sessão de pacote — é receita que ficou de fora do caixa.",
    },
    missing.map((a) => ({
      id: a.id,
      subject: names.get(a.patient_id) ?? "Paciente",
      detail: `${new Date(a.scheduled_at).toLocaleString("pt-BR")} · ${profs.get(a.professional_id) ?? "—"}`,
      since: a.scheduled_at,
      amount: null,
      href: `/recepcao/agenda?data=${toClinicDate(a.scheduled_at)}`,
    }))
  )
}

// ---------------------------------------------------------------------------
// PACOTES
// ---------------------------------------------------------------------------

/** Saldo esgotado e o pacote continua `active`: o gatilho de consumo não fechou. */
const exhaustedPackages: Check = async (supabase, clinicId) => {
  const { data } = await supabase
    .from("patient_packages")
    .select("id, patient_id, total_sessions, sessions_used")
    .eq("clinic_id", clinicId)
    .eq("status", "active")
    .limit(SCAN_LIMIT)

  const rows = (data ?? []).filter((p) => p.sessions_used >= p.total_sessions)
  if (rows.length === 0) return null

  const names = await patientNames(supabase, rows.map((p) => p.patient_id))

  return group(
    {
      key: "exhausted-package",
      domain: "pacotes",
      severity: "warning",
      title: "Pacote esgotado ainda marcado como ativo",
      explanation:
        "Todas as sessões já foram consumidas e o pacote continua ativo. Ele segue aparecendo como saldo disponível no agendamento.",
    },
    rows.map((p) => ({
      id: p.id,
      subject: names.get(p.patient_id) ?? "Paciente",
      detail: `${p.sessions_used} de ${p.total_sessions} sessões usadas`,
      since: null,
      amount: null,
      href: `/recepcao/pacientes/${p.patient_id}`,
    }))
  )
}

/** Sessão reservada presa num agendamento que não vai acontecer. */
const strandedPackageSessions: Check = async (supabase, clinicId) => {
  const { data: packages } = await supabase
    .from("patient_packages")
    .select("id, patient_id")
    .eq("clinic_id", clinicId)
    .eq("status", "active")
    .limit(SCAN_LIMIT)

  const packageIds = (packages ?? []).map((p) => p.id)
  if (packageIds.length === 0) return null

  const { data: sessions } = await supabase
    .from("patient_package_sessions")
    .select("id, patient_package_id, appointment_id, session_number")
    .in("patient_package_id", packageIds)
    .eq("status", "reserved")
    .not("appointment_id", "is", null)
    .limit(SCAN_LIMIT)

  const rows = sessions ?? []
  if (rows.length === 0) return null

  const { data: dead } = await supabase
    .from("appointments")
    .select("id, status")
    .in("id", rows.map((s) => s.appointment_id).filter((v): v is string => Boolean(v)))
    .in("status", ["cancelled", "no_show"])

  const deadById = new Map((dead ?? []).map((a) => [a.id, a.status]))
  const stranded = rows.filter((s) => s.appointment_id && deadById.has(s.appointment_id))
  if (stranded.length === 0) return null

  const patientByPackage = new Map((packages ?? []).map((p) => [p.id, p.patient_id]))
  const names = await patientNames(
    supabase,
    stranded.map((s) => patientByPackage.get(s.patient_package_id)).filter((v): v is string => Boolean(v))
  )

  return group(
    {
      key: "stranded-package-session",
      domain: "pacotes",
      severity: "warning",
      title: "Sessão de pacote reservada para atendimento que não aconteceu",
      explanation:
        "A sessão continua reservada num agendamento cancelado ou com falta. Ela não foi consumida nem devolvida ao saldo — o paciente perde a posição sem ter usado.",
    },
    stranded.map((s) => {
      const patientId = patientByPackage.get(s.patient_package_id)
      return {
        id: s.id,
        subject: (patientId ? names.get(patientId) : null) ?? "Paciente",
        detail: `Sessão ${s.session_number} · agendamento ${deadById.get(s.appointment_id!) === "no_show" ? "com falta" : "cancelado"}`,
        since: null,
        amount: null,
        href: patientId ? `/recepcao/pacientes/${patientId}` : null,
      }
    })
  )
}

// ---------------------------------------------------------------------------
// CADASTRO
// ---------------------------------------------------------------------------

/** Sem telefone e sem WhatsApp não há como confirmar nem lembrar o paciente. */
const patientsWithoutContact: Check = async (supabase, clinicId) => {
  const { data } = await supabase
    .from("patients")
    .select("id, full_name, social_name")
    .eq("clinic_id", clinicId)
    .eq("active", true)
    // Chamadas `.or()` sucessivas são combinadas com AND pelo PostgREST, então isto lê
    // "sem telefone E sem whatsapp". String vazia entra junto do nulo: um campo salvo em
    // branco é tão inútil para contatar quanto um ausente.
    .or("phone.is.null,phone.eq.")
    .or("whatsapp.is.null,whatsapp.eq.")
    .order("full_name")
    .limit(SCAN_LIMIT)

  const rows = data ?? []
  if (rows.length === 0) return null

  return group(
    {
      key: "patient-no-contact",
      domain: "cadastro",
      severity: "info",
      title: "Paciente ativo sem telefone nem WhatsApp",
      explanation:
        "Sem nenhum contato o paciente fica fora de confirmação, lembrete e régua de cobrança. Complete o cadastro na próxima visita.",
    },
    rows.map((p) => ({
      id: p.id,
      subject: p.social_name || p.full_name,
      detail: "Nenhum contato cadastrado",
      since: null,
      amount: null,
      href: `/recepcao/pacientes/${p.id}`,
    }))
  )
}

const CHECKS: Check[] = [
  releasedNotSent,
  paidButStillGated,
  checkedInWithoutQueue,
  orphanQueueEntries,
  longWait,
  openTooLong,
  appointmentsWithoutOutcome,
  overdueStillPending,
  completedWithoutCharge,
  exhaustedPackages,
  strandedPackageSessions,
  patientsWithoutContact,
]

const SEVERITY_ORDER: Record<AnomalySeverity, number> = { critical: 0, warning: 1, info: 2 }

export type AnomalyScan = {
  groups: AnomalyGroup[]
  counts: Record<AnomalySeverity, number>
  total: number
  /** Verificações que não puderam rodar (tabela ausente, permissão) — reportado, não escondido. */
  skipped: number
}

/**
 * Roda todas as verificações em paralelo. Uma que falhe não derruba a varredura: a tela
 * existe para mostrar o que está errado, e sumir inteira por causa de uma consulta seria
 * exatamente o oposto disso.
 */
export async function scanAnomalies(supabase: DB, clinicId: string): Promise<AnomalyScan> {
  const settled = await Promise.allSettled(CHECKS.map((check) => check(supabase, clinicId)))

  const groups: AnomalyGroup[] = []
  let skipped = 0
  for (const result of settled) {
    if (result.status === "rejected") {
      console.error("anomaly check failed", result.reason)
      skipped += 1
      continue
    }
    if (result.value) groups.push(result.value)
  }

  groups.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.items.length - a.items.length
  )

  const counts: Record<AnomalySeverity, number> = { critical: 0, warning: 0, info: 0 }
  for (const g of groups) counts[g.severity] += g.items.length

  return {
    groups,
    counts,
    total: counts.critical + counts.warning + counts.info,
    skipped,
  }
}
