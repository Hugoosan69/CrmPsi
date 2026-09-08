import Link from "next/link"
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Info,
  Layers,
  ListOrdered,
  ShieldAlert,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"

import { requireAreaAccess } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import {
  scanAnomalies,
  type AnomalyDomain,
  type AnomalyGroup,
  type AnomalySeverity,
} from "@/services/process-anomalies.service"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusDot, type StatusTone } from "@/components/shared/status-dot"
import { cn } from "@/lib/utils"

/** Item 20: nunca só cor — cada severidade tem ícone, ponto e texto. */
const SEVERITY: Record<
  AnomalySeverity,
  { label: string; tone: StatusTone; Icon: LucideIcon; accent: string; wash: string }
> = {
  critical: {
    label: "Crítico",
    tone: "danger",
    Icon: ShieldAlert,
    accent: "text-status-danger",
    wash: "border-status-danger/30 bg-status-danger/[0.04]",
  },
  warning: {
    label: "Atenção",
    tone: "warning",
    Icon: AlertTriangle,
    accent: "text-status-warning",
    wash: "border-status-warning/30 bg-status-warning/[0.04]",
  },
  info: {
    label: "Informativo",
    tone: "info",
    Icon: Info,
    accent: "text-status-info",
    wash: "border-border bg-card",
  },
}

const DOMAIN: Record<AnomalyDomain, { label: string; Icon: LucideIcon }> = {
  fila: { label: "Fila", Icon: ListOrdered },
  agenda: { label: "Agenda", Icon: CalendarDays },
  financeiro: { label: "Financeiro", Icon: Wallet },
  pacotes: { label: "Pacotes", Icon: Layers },
  cadastro: { label: "Cadastro", Icon: Users },
}

/** `amount` é numeric(10,2) — reais, não centavos. */
function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function SummaryCard({
  severity,
  count,
  hint,
}: {
  severity: AnomalySeverity
  count: number
  hint: string
}) {
  const { label, Icon, accent, wash } = SEVERITY[severity]
  const empty = count === 0
  return (
    <div
      className={cn(
        "grid gap-1 rounded-xl border p-4",
        empty ? "border-border bg-card" : wash
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.8rem] font-medium text-muted-foreground">{label}</span>
        <Icon className={cn("size-4", empty ? "text-muted-foreground" : accent)} aria-hidden />
      </div>
      <span
        className={cn(
          "metric text-2xl font-semibold tabular-nums",
          empty ? "text-muted-foreground" : accent
        )}
      >
        {count}
      </span>
      <span className="text-[0.75rem] text-muted-foreground">{hint}</span>
    </div>
  )
}

function AnomalySection({ group }: { group: AnomalyGroup }) {
  const severity = SEVERITY[group.severity]
  const domain = DOMAIN[group.domain]

  return (
    <section className={cn("grid gap-3 rounded-xl border p-4", severity.wash)}>
      <header className="grid gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <severity.Icon className={cn("size-4 shrink-0", severity.accent)} aria-hidden />
          <h2 className="font-heading text-[0.95rem] font-semibold">{group.title}</h2>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[0.7rem] font-semibold tabular-nums",
              group.severity === "critical" && "bg-status-danger/12 text-status-danger",
              group.severity === "warning" && "bg-status-warning/12 text-status-warning",
              group.severity === "info" && "bg-status-info/12 text-status-info"
            )}
          >
            {group.items.length}
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[0.75rem] text-muted-foreground">
            <domain.Icon className="size-3.5" aria-hidden />
            {domain.label}
          </span>
        </div>
        <p className="text-[0.8rem] text-muted-foreground">{group.explanation}</p>
      </header>

      <ul className="grid gap-1.5">
        {group.items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-border bg-card px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.875rem] font-medium">{item.subject}</p>
              <p className="truncate text-[0.75rem] text-muted-foreground">{item.detail}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {item.amount !== null && (
                <span className="metric text-[0.875rem] font-semibold tabular-nums">
                  {formatCurrency(item.amount)}
                </span>
              )}
              {item.href && (
                <Link
                  href={item.href}
                  className="text-[0.8rem] font-medium text-primary underline-offset-2 hover:underline"
                >
                  Resolver
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default async function ProcessAnomaliesPage() {
  // Não é uma tela financeira: ela cruza fila, agenda, pacotes e cadastro. `audit.view` é a
  // permissão que já significa "pode olhar o que o sistema registrou sobre si mesmo".
  const membership = await requireAreaAccess(PERMISSIONS.MANAGEMENT_ACCESS, PERMISSIONS.AUDIT_VIEW)
  const supabase = await createClient()
  const scan = await scanAnomalies(supabase, membership.clinicId)

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Anomalias de processo"
        description="Tudo que o sistema consegue provar que está fora do esperado — fila, agenda, financeiro, pacotes e cadastro."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          severity="critical"
          count={scan.counts.critical}
          hint="Paciente ou dinheiro parado agora"
        />
        <SummaryCard
          severity="warning"
          count={scan.counts.warning}
          hint="Registro inconsistente, resolver hoje"
        />
        <SummaryCard
          severity="info"
          count={scan.counts.info}
          hint="Cadastro incompleto, sem urgência"
        />
      </div>

      {scan.skipped > 0 && (
        <p
          className="rounded-lg border border-status-warning/30 bg-status-warning/[0.06] px-3 py-2 text-[0.8rem] text-muted-foreground"
          role="status"
        >
          <StatusDot tone="warning" label={`${scan.skipped} verificação(ões) não puderam rodar`} />{" "}
          Alguma tabela pode não existir ainda neste banco. Confira as migrations pendentes em
          database/migrations.
        </p>
      )}

      {scan.total === 0 ? (
        <EmptyState
          title="Nenhuma anomalia encontrada"
          description="Fila, agenda, financeiro, pacotes e cadastro estão consistentes neste momento."
        />
      ) : (
        <div className="grid gap-4">
          {scan.groups.map((group) => (
            <AnomalySection key={group.key} group={group} />
          ))}
        </div>
      )}

      <p className="flex items-center gap-1.5 text-[0.75rem] text-muted-foreground">
        <CheckCircle2 className="size-3.5" aria-hidden />
        Verificação feita agora, ao abrir a página. Recarregue para refazer a varredura.
      </p>
    </div>
  )
}
