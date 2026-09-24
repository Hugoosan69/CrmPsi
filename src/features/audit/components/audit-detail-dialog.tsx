"use client"

import { Info } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { AuditLogRow } from "@/services/audit.service"
import type { Json } from "@/types/supabase"
import { ACTION_LABELS, ENTITY_LABELS } from "./audit-labels"

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(iso))
}

/** Par rótulo/valor — mesma moldura usada em `TransactionDetailDialog`. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-[0.8rem] text-muted-foreground">{label}</span>
      <span className="text-[0.85rem] font-medium">{children}</span>
    </div>
  )
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function ChangedFields({ before, after }: { before: Json | null; after: Json | null }) {
  const beforeObj = before && typeof before === "object" && !Array.isArray(before) ? before : null
  const afterObj = after && typeof after === "object" && !Array.isArray(after) ? after : null

  if (!beforeObj && !afterObj) {
    return <p className="text-[0.82rem] text-muted-foreground">Sem dados adicionais registrados.</p>
  }

  // Só o registro final (criação, sem "antes"): lista os campos como estão.
  if (afterObj && !beforeObj) {
    return (
      <div className="grid gap-0">
        {Object.entries(afterObj).map(([key, val]) => (
          <Row key={key} label={key}>
            {stringify(val)}
          </Row>
        ))}
      </div>
    )
  }

  // Antes e depois: só os campos que de fato mudaram.
  if (beforeObj && afterObj) {
    const allKeys = [...new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)])]
    const changed = allKeys.filter(
      (k) => JSON.stringify(beforeObj[k]) !== JSON.stringify(afterObj[k])
    )
    if (changed.length === 0) {
      return <p className="text-[0.82rem] text-muted-foreground">Nenhum campo mudou de valor.</p>
    }
    return (
      <div className="grid gap-0">
        {changed.map((key) => (
          <Row key={key} label={key}>
            <span className="text-status-danger line-through">{stringify(beforeObj[key])}</span>
            {" → "}
            <span className="text-status-success">{stringify(afterObj[key])}</span>
          </Row>
        ))}
      </div>
    )
  }

  // Só "antes" (exclusão): o que existia até este registro.
  return (
    <div className="grid gap-0">
      {beforeObj &&
        Object.entries(beforeObj).map(([key, val]) => (
          <Row key={key} label={key}>
            {stringify(val)}
          </Row>
        ))}
    </div>
  )
}

export function AuditDetailDialog({ row }: { row: AuditLogRow }) {
  const hasDetail = row.before !== null || row.after !== null

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" disabled={!hasDetail}>
            <Info className="size-3.5" /> Detalhes
          </Button>
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{ACTION_LABELS[row.action] ?? row.action}</DialogTitle>
          <DialogDescription>
            {ENTITY_LABELS[row.entityType] ?? row.entityType} · {formatDateTime(row.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-0 rounded-lg border border-border px-3">
            <Row label="Usuário">{row.userName ?? "Sistema"}</Row>
            <Row label="Quando">{formatDateTime(row.createdAt)}</Row>
            {row.entityId && <Row label="ID do registro">{row.entityId}</Row>}
          </div>

          <div className="grid gap-1.5">
            <p className="text-[0.7rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
              O que mudou
            </p>
            <div className="rounded-lg border border-border px-3">
              <ChangedFields before={row.before} after={row.after} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
