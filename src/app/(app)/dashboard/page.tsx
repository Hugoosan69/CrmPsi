import Link from "next/link"
import {
  ArrowUpRight,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  ListOrdered,
  Package,
  Receipt,
  Stethoscope,
  TrendingDown,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react"

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireMembership, hasPermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import {
  getClinicSummary,
  getManagementSummary,
  getProfessionalSummary,
  getReceptionSummary,
} from "@/services/dashboard.service"
import { getProfessionalByUserId, listProfessionals } from "@/services/professionals.service"
import { getOccupancy, type OccupancyRow } from "@/services/availability.service"
import { pendingMigrationFor } from "@/lib/db-errors"
import { OccupancyPanel } from "@/features/scheduling/components/occupancy-panel"
import { todaySaoPauloDate } from "@/utils/datetime"
import { cn } from "@/lib/utils"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

type OccupancyBlock =
  | { kind: "data"; rows: OccupancyRow[]; professionals: { id: string; full_name: string }[]; periodLabel: string }
  | { kind: "migration"; migration: string }

/**
 * Occupancy depends on migrations/002. Rather than letting a missing migration throw the
 * whole dashboard into the error boundary, it degrades to a named, actionable notice —
 * every other indicator on this page still works without it.
 */
async function loadOccupancy(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  today: string
): Promise<OccupancyBlock> {
  const { start, end } = monthBounds(today)
  try {
    const [rows, professionals] = await Promise.all([
      getOccupancy(supabase, clinicId, start, end),
      listProfessionals(supabase, clinicId),
    ])
    return {
      kind: "data",
      rows,
      professionals: professionals.filter((p) => p.active).map((p) => ({ id: p.id, full_name: p.full_name })),
      periodLabel: `${new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(new Date(`${start}T12:00:00-03:00`))} · horário semanal cadastrado × agendado`,
    }
  } catch (err) {
    const migration = pendingMigrationFor(err)
    if (migration) return { kind: "migration", migration }
    throw err
  }
}

/** First and last clinic-local calendar day of the month containing `today`. */
function monthBounds(today: string) {
  const start = `${today.slice(0, 7)}-01`
  const [year, month] = today.split("-").map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { start, end: `${today.slice(0, 7)}-${String(lastDay).padStart(2, "0")}` }
}

/** Item 25: the dashboard varies by profile — each section below only renders for the
 * permissions that make it relevant, so one owner/admin login can see all three. */
export default async function DashboardPage() {
  const membership = await requireMembership()
  const supabase = await createClient()
  const today = todaySaoPauloDate()

  const canSeePatients = hasPermission(membership, PERMISSIONS.PATIENTS_VIEW)
  const canManageCatalog = hasPermission(membership, PERMISSIONS.SETTINGS_MANAGE)
  const canSeeReception = hasPermission(membership, PERMISSIONS.QUEUE_MANAGE)
  const canSeeService = hasPermission(membership, PERMISSIONS.SERVICE_MANAGE)
  const canSeeFinancial = hasPermission(membership, PERMISSIONS.FINANCIAL_VIEW)

  const [summary, receptionSummary, managementSummary, professional] = await Promise.all([
    getClinicSummary(supabase, membership.clinicId),
    canSeeReception ? getReceptionSummary(supabase, membership.clinicId, today) : null,
    canSeeFinancial ? getManagementSummary(supabase, membership.clinicId, today) : null,
    canSeeService ? getProfessionalByUserId(supabase, membership.clinicId, membership.userId) : null,
  ])

  const professionalSummary = professional
    ? await getProfessionalSummary(supabase, membership.clinicId, professional.id, today)
    : null

  // Occupancy is the owner's question ("where is the idle capacity?"), so it follows the
  // same permission as the rest of the management block. It reads through the agenda's own
  // availability definition, which only exists once migrations/002 is applied — hence the
  // tolerant read: an un-migrated database should show one clear setup prompt, not take
  // the whole dashboard down.
  const occupancy = canSeeFinancial
    ? await loadOccupancy(supabase, membership.clinicId, today)
    : null

  return (
    <div className="grid gap-7">
      <div className="animate-fade-in-up">
        <p className="text-[0.7rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          {new Intl.DateTimeFormat("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            timeZone: "America/Sao_Paulo",
          }).format(new Date())}
        </p>
        <h1 className="mt-1 font-heading text-[1.7rem] font-semibold">
          Olá, {membership.fullName.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          {membership.clinicName} · {membership.roleName}
        </p>
      </div>

      {professionalSummary && (
        <Section title="Meu dia">
          <SummaryCard
            label="Consultas hoje"
            value={professionalSummary.todayTotal}
            icon={CalendarDays}
            href="/profissional/agenda"
          />
          <SummaryCard
            label="Concluídas"
            value={professionalSummary.todayCompleted}
            icon={CheckCircle2}
            tone="success"
          />
          <SummaryCard
            label="Na minha fila"
            value={professionalSummary.queueWaiting}
            icon={ListOrdered}
            tone={professionalSummary.queueWaiting > 0 ? "warning" : "neutral"}
            href="/profissional/fila"
          />
        </Section>
      )}

      {receptionSummary && (
        <Section title="Recepção — hoje">
          <SummaryCard
            label="Consultas hoje"
            value={receptionSummary.todayTotal}
            hint={`${receptionSummary.todayConfirmed} confirmadas`}
            icon={CalendarCheck}
            href="/recepcao/agenda"
          />
          <SummaryCard
            label="Aguardando"
            value={receptionSummary.waiting}
            icon={Clock}
            tone={receptionSummary.waiting > 0 ? "warning" : "neutral"}
            href="/recepcao/fila"
          />
          <SummaryCard
            label="Em atendimento"
            value={receptionSummary.inService}
            icon={Stethoscope}
            tone={receptionSummary.inService > 0 ? "info" : "neutral"}
            href="/recepcao/fila"
          />
          <SummaryCard
            label="Pagamentos pendentes"
            value={receptionSummary.pendingPaymentsCount}
            hint={
              receptionSummary.pendingPaymentsTotal > 0
                ? formatCurrency(receptionSummary.pendingPaymentsTotal)
                : undefined
            }
            icon={Receipt}
            tone={receptionSummary.pendingPaymentsCount > 0 ? "warning" : "neutral"}
            href="/recepcao/financeiro"
          />
        </Section>
      )}

      {managementSummary && (
        <Section title="Gestão — mês atual">
          <SummaryCard
            label="Faturado"
            value={formatCurrency(managementSummary.monthRevenuePaid)}
            icon={CircleDollarSign}
            tone="success"
            href="/gestao/financeiro"
          />
          <SummaryCard
            label="A receber"
            value={formatCurrency(managementSummary.monthRevenuePending)}
            icon={Receipt}
            tone={managementSummary.monthRevenuePending > 0 ? "warning" : "neutral"}
          />
          <SummaryCard
            label="Despesas"
            value={formatCurrency(managementSummary.monthExpenses)}
            icon={TrendingDown}
          />
          <SummaryCard
            label="Atendimentos"
            value={managementSummary.monthAppointments}
            hint={`${managementSummary.monthCancelled} cancelados · ${managementSummary.monthNoShow} faltas`}
            icon={CalendarDays}
          />
        </Section>
      )}

      {occupancy?.kind === "data" && (
        <div className="animate-fade-in-up">
          <OccupancyPanel
            rows={occupancy.rows}
            professionals={occupancy.professionals}
            periodLabel={occupancy.periodLabel}
          />
        </div>
      )}

      {occupancy?.kind === "migration" && (
        <div className="rounded-xl border border-status-warning/40 bg-status-warning/5 px-5 py-4">
          <p className="text-sm font-medium">Ocupação da agenda indisponível</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Rode{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8rem] text-foreground">
              database/migrations/{occupancy.migration}
            </code>{" "}
            no SQL Editor do Supabase para habilitar horário de atendimento, salas e
            indicadores de ocupação.
          </p>
        </div>
      )}

      <Section title="Cadastros">
        <SummaryCard
          label="Pacientes ativos"
          value={summary.activePatients}
          icon={UserRound}
          href={canSeePatients ? "/recepcao/pacientes" : undefined}
        />
        <SummaryCard
          label="Profissionais"
          value={summary.activeProfessionals}
          icon={UsersRound}
          href={canManageCatalog ? "/gestao/profissionais" : undefined}
        />
        <SummaryCard
          label="Procedimentos"
          value={summary.activeProcedures}
          icon={Package}
          tone={summary.activeProcedures === 0 ? "warning" : "neutral"}
          hint={summary.activeProcedures === 0 ? "cadastre para agendar" : undefined}
          href={canManageCatalog ? "/gestao/procedimentos" : undefined}
        />
      </Section>

      {!receptionSummary && !managementSummary && !professionalSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sem indicadores para o seu perfil</CardTitle>
            <CardDescription>
              Fale com a gestão se acha que deveria ter acesso a agenda, fila ou financeiro.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center gap-2.5">
        <h2 className="font-heading text-[0.95rem] font-semibold">{title}</h2>
        <span className="h-px flex-1 bg-border" aria-hidden />
      </div>
      <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  )
}

type Tone = "neutral" | "info" | "success" | "warning"

const TONE_CHIP: Record<Tone, string> = {
  neutral: "bg-secondary text-secondary-foreground",
  info: "bg-status-info/12 text-status-info",
  success: "bg-status-success/12 text-status-success",
  warning: "bg-status-warning/14 text-status-warning",
}

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  href,
}: {
  label: string
  value: number | string
  hint?: string
  icon: LucideIcon
  tone?: Tone
  href?: string
}) {
  const content = (
    <Card
      className={cn(
        "h-full",
        href && "transition-all duration-200 hover:border-ring/40 hover:shadow-card"
      )}
    >
      <CardHeader className="gap-0">
        <div className="flex items-start justify-between gap-3">
          <CardDescription className="text-[0.72rem] font-medium tracking-wide uppercase">
            {label}
          </CardDescription>
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg",
              TONE_CHIP[tone]
            )}
            aria-hidden
          >
            <Icon className="size-[0.95rem]" />
          </span>
        </div>
        <CardTitle className="metric mt-2 font-heading text-[1.65rem] leading-none font-semibold">
          {value}
        </CardTitle>
        <div className="mt-1.5 flex min-h-4 items-center gap-1 text-[0.72rem] text-muted-foreground">
          {hint && <span className="truncate">{hint}</span>}
          {href && (
            <ArrowUpRight className="ml-auto size-3.5 shrink-0 opacity-0 transition-opacity group-hover/card:opacity-60" />
          )}
        </div>
      </CardHeader>
    </Card>
  )

  // `group/card` has to be declared on the hover target itself, otherwise the
  // `group-hover/card:` arrow above never reveals — it named a group that didn't exist.
  return href ? (
    <Link
      href={href}
      className="group/card block h-full"
      aria-label={hint ? `${label}: ${value} — ${hint}` : `${label}: ${value}`}
    >
      {content}
    </Link>
  ) : (
    content
  )
}
