"use client"

import { useTransition } from "react"

import { RowActions, type RowAction } from "@/components/shared/row-actions"
import { Send, X } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/components/shared/empty-state"
import { formatDateTime } from "@/utils/datetime"
import type { Campaign, CampaignStatus } from "@/services/communication.service"
import { cancelCampaignAction, dispatchCampaignAction } from "../actions/campaign.actions"

const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  sending: "Enviando",
  sent: "Enviada",
  cancelled: "Cancelada",
  failed: "Falhou",
}

const AUDIENCE_LABEL: Record<Campaign["audience"], string> = {
  active: "Ativos",
  inactive: "Inativos",
  all: "Todos",
  single: "Uma pessoa",
}

export function CampaignsTable({ campaigns }: { campaigns: Campaign[] }) {
  const [isPending, start] = useTransition()

  if (campaigns.length === 0) {
    return (
      <EmptyState
        title="Nenhuma campanha ainda"
        description="Crie uma na aba ao lado para avisar sobre uma promoção, um evento ou um recesso."
      />
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Campanha</TableHead>
            <TableHead className="hidden md:table-cell">Público</TableHead>
            <TableHead>Quando</TableHead>
            <TableHead>Resultado</TableHead>
            <TableHead className="w-1" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => {
            const canSend =
              campaign.status === "draft" ||
              campaign.status === "scheduled" ||
              campaign.status === "failed"
            return (
              <TableRow key={campaign.id}>
                <TableCell>
                  <p className="font-medium">{campaign.name}</p>
                  <p className="text-[0.72rem] text-muted-foreground uppercase">
                    {campaign.channel}
                  </p>
                </TableCell>
                <TableCell className="hidden md:table-cell">{AUDIENCE_LABEL[campaign.audience]}</TableCell>
                <TableCell className="text-[0.82rem] text-muted-foreground">
                  {campaign.scheduled_for ? formatDateTime(campaign.scheduled_for) : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={campaign.status === "sent" ? "default" : "secondary"}>
                    {STATUS_LABEL[campaign.status]}
                  </Badge>
                  {campaign.status === "sent" && (
                    <span className="ml-2 text-[0.75rem] text-muted-foreground tabular-nums">
                      {campaign.sent_count} enviada(s)
                      {campaign.failed_count > 0 && `, ${campaign.failed_count} falha(s)`}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <RowActions
                    label={`Ações de ${campaign.name}`}
                    actions={[
                      ...(canSend
                        ? [
                            {
                              key: "send",
                              label: "Disparar",
                              icon: Send,
                              disabled: isPending,
                              onSelect: () =>
                                start(async () => {
                                  const r = await dispatchCampaignAction(campaign.id)
                                  if (r.error) toast.error(r.error)
                                  else if (r.success) toast.success(r.success)
                                }),
                            } satisfies RowAction,
                          ]
                        : []),
                      ...(campaign.status === "draft" || campaign.status === "scheduled"
                        ? [
                            {
                              key: "cancel",
                              label: "Cancelar campanha",
                              icon: X,
                              danger: true,
                              disabled: isPending,
                              onSelect: () =>
                                start(async () => {
                                  const r = await cancelCampaignAction(campaign.id)
                                  if (r.error) toast.error(r.error)
                                  else if (r.success) toast.success(r.success)
                                }),
                            } satisfies RowAction,
                          ]
                        : []),
                    ]}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
