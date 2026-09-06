import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusDot, type StatusTone } from "@/components/shared/status-dot"
import type { BillingPayer } from "@/types/supabase"
import type { BillingTypeView } from "@/services/billing.service"
import { BillingTypeRowActions } from "./billing-type-row-actions"

const PAYER: Record<BillingPayer, { label: string; tone: StatusTone }> = {
  paciente: { label: "Paciente", tone: "info" },
  convenio: { label: "Convênio", tone: "success" },
  ninguem: { label: "Cortesia", tone: "neutral" },
}

function formatCurrency(value: number | null) {
  if (value === null) return null
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

export function BillingTypesTable({ billingTypes }: { billingTypes: BillingTypeView[] }) {
  if (billingTypes.length === 0) {
    return (
      <EmptyState
        title="Nenhum tipo de cobrança cadastrado"
        description="Cadastre como a clínica cobra: particular, convênio ou cortesia."
      />
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Quem paga</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Por guia</TableHead>
          <TableHead className="hidden text-right md:table-cell">Sem guia</TableHead>
          <TableHead className="hidden lg:table-cell">Contato</TableHead>
          <TableHead className="w-1" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {billingTypes.map((t) => {
          const payer = PAYER[t.payer]
          return (
            <TableRow key={t.id}>
              <TableCell className="font-medium">
                <div className="flex flex-wrap items-center gap-2">
                  {t.name}
                  {!t.active && <Badge variant="secondary">Inativo</Badge>}
                </div>
                {t.authorizationsInUse > 0 && (
                  <p className="text-[0.72rem] font-normal text-muted-foreground">
                    {t.authorizationsInUse} autorização(ões)
                  </p>
                )}
              </TableCell>

              <TableCell>
                <StatusDot tone={payer.tone} label={payer.label} />
              </TableCell>

              <TableCell className="hidden text-right tabular-nums sm:table-cell">
                {formatCurrency(t.amount_per_guide) ?? <span className="text-muted-foreground">—</span>}
              </TableCell>

              <TableCell className="hidden text-right tabular-nums md:table-cell">
                {formatCurrency(t.fallback_amount) ?? <span className="text-muted-foreground">—</span>}
              </TableCell>

              <TableCell className="hidden text-[0.8rem] text-muted-foreground lg:table-cell">
                {t.contact_name || t.contact_email || t.contact_phone || "—"}
              </TableCell>

              <TableCell>
                <BillingTypeRowActions billingType={t} />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
