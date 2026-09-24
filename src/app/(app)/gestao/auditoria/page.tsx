import { Suspense } from "react"
import { ScrollText } from "lucide-react"

import { requireAreaAccess } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { PageHeader } from "@/components/shared/page-header"
import { parsePagination, PAGE_PARAM, PAGE_SIZE_PARAM } from "@/config/pagination"
import {
  listAuditLogs,
  getAuditEntityTypes,
  getAuditActions,
} from "@/services/audit.service"
import { AuditLogTable } from "@/features/audit/components/audit-log-table"
import { SandboxToggle } from "@/features/audit/components/sandbox-toggle"
import { isSandboxMode, isSandboxConfigured } from "@/lib/supabase/sandbox"

export default async function AuditPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const membership = await requireAreaAccess(
    PERMISSIONS.MANAGEMENT_ACCESS,
    PERMISSIONS.AUDIT_VIEW
  )
  const params = await props.searchParams

  const supabase = await createClient()
  const { page, pageSize, offset } = parsePagination({
    page: params[PAGE_PARAM] as string | undefined,
    pageSize: params[PAGE_SIZE_PARAM] as string | undefined,
  })

  const filters = {
    dateFrom: (params.de as string) || undefined,
    dateTo: (params.ate as string) || undefined,
    userId: (params.usuario as string) || undefined,
    entityType: (params.entidade as string) || undefined,
    action: (params.acao as string) || undefined,
    search: (params.busca as string) || undefined,
  }

  const [{ rows, total }, entityTypes, actions, membersData] = await Promise.all([
    listAuditLogs(supabase, membership.clinicId, filters, offset, pageSize),
    getAuditEntityTypes(supabase, membership.clinicId),
    getAuditActions(supabase, membership.clinicId),
    supabase
      .from("profiles")
      .select("id, full_name")
      .in(
        "id",
        (
          await supabase
            .from("clinic_memberships")
            .select("user_id")
            .eq("clinic_id", membership.clinicId)
        ).data?.map((m) => m.user_id) ?? []
      ),
  ])

  const users = (membersData.data ?? []).map((p) => ({
    id: p.id,
    name: p.full_name,
  }))

  const sandboxOn = await isSandboxMode()
  const sandboxAvailable =
    isSandboxConfigured() && membership.permissions.has(PERMISSIONS.SANDBOX_TOGGLE)

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Auditoria"
          description="Registro de todas as ações realizadas no sistema — quem fez, quando e o que mudou."
        />
        {sandboxAvailable && <SandboxToggle active={sandboxOn} />}
      </div>

      {sandboxOn && (
        <div className="flex items-center gap-2 rounded-lg border border-status-warning/40 bg-status-warning/[0.08] px-4 py-2.5 text-[0.82rem] text-status-warning">
          <ScrollText className="size-4 shrink-0" />
          <span>
            <strong>Modo sandbox ativo.</strong> Os dados abaixo são do banco de homologação,
            não de produção.
          </span>
        </div>
      )}

      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl border border-border bg-card" />}>
        <AuditLogTable
          rows={rows}
          total={total}
          page={page}
          pageSize={pageSize}
          entityTypes={entityTypes}
          actions={actions}
          users={users}
          filters={filters}
        />
      </Suspense>
    </div>
  )
}
