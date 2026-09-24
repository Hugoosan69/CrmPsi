import { FlaskConical } from "lucide-react"

import { requireAreaAccess } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { PageHeader } from "@/components/shared/page-header"
import { PaginationBar } from "@/components/shared/pagination-bar"
import { parsePagination, PAGE_PARAM, PAGE_SIZE_PARAM } from "@/config/pagination"
import {
  listAuditLogs,
  getAuditEntityTypes,
  getAuditActions,
} from "@/services/audit.service"
import { AuditLogTable } from "@/features/audit/components/audit-log-table"
import { AuditFilters } from "@/features/audit/components/audit-filters"
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

  const de = (params.de as string) || undefined
  const ate = (params.ate as string) || undefined
  const usuario = (params.usuario as string) || undefined
  const entidade = (params.entidade as string) || undefined
  const acao = (params.acao as string) || undefined

  const filters = {
    dateFrom: de,
    dateTo: ate,
    userId: usuario,
    entityType: entidade,
    action: acao,
  }

  const [{ rows, total }, entityTypes, actions, memberIdsResult] = await Promise.all([
    listAuditLogs(supabase, membership.clinicId, filters, offset, pageSize),
    getAuditEntityTypes(supabase, membership.clinicId),
    getAuditActions(supabase, membership.clinicId),
    supabase.from("clinic_memberships").select("user_id").eq("clinic_id", membership.clinicId),
  ])

  const memberIds = (memberIdsResult.data ?? []).map((m) => m.user_id)
  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", memberIds.length > 0 ? memberIds : ["00000000-0000-0000-0000-000000000000"])

  const users = (profilesData ?? [])
    .map((p) => ({ id: p.id, name: p.full_name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))

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
          <FlaskConical className="size-4 shrink-0" />
          <span>
            <strong>Modo sandbox ativo.</strong> Os dados abaixo são do banco de homologação,
            não de produção.
          </span>
        </div>
      )}

      <AuditFilters
        values={{ de, ate, usuario, entidade, acao }}
        users={users}
        entityTypes={entityTypes}
        actions={actions}
      />

      <div className="grid gap-3">
        <AuditLogTable rows={rows} />
        <PaginationBar total={total} page={page} pageSize={pageSize} label="registros" />
      </div>
    </div>
  )
}
