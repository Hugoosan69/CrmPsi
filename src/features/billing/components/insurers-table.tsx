"use client"

import { Pencil, Power } from "lucide-react"

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
import { RowActions, type RowAction } from "@/components/shared/row-actions"
import { ToggleActiveButton } from "@/components/shared/toggle-active-button"
import type { InsurerView } from "@/services/billing.service"
import { setInsurerActiveAction } from "../actions/billing.actions"
import { EditInsurerDialog } from "./insurer-dialogs"
import type { ProcedureOption } from "./insurer-form-fields"

function InsurerRowActions({
  insurer,
  procedures,
}: {
  insurer: InsurerView
  procedures: ProcedureOption[]
}) {
  const emUso = insurer.appointmentsCount > 0

  const actions: RowAction[] = [
    {
      key: "edit",
      label: "Editar",
      icon: Pencil,
      render: (control) => (
        <EditInsurerDialog insurer={insurer} procedures={procedures} {...control} />
      ),
    },
    {
      key: "toggle",
      label: insurer.active ? "Inativar" : "Ativar",
      icon: Power,
      danger: insurer.active,
      render: (control) => (
        <ToggleActiveButton
          active={insurer.active}
          activateLabel="Ativar"
          deactivateLabel="Inativar"
          confirmTitle={insurer.active ? "Inativar convênio?" : "Ativar convênio?"}
          confirmDescription={
            insurer.active
              ? emUso
                ? `Já existem ${insurer.appointmentsCount} atendimento(s) com este convênio. Eles continuam como estão — ele só deixa de aparecer em novos agendamentos.`
                : "Ele deixará de aparecer como opção em novos agendamentos."
              : "Ele voltará a aparecer como opção em novos agendamentos."
          }
          action={setInsurerActiveAction.bind(null, insurer.id, !insurer.active)}
          {...control}
        />
      ),
    },
  ]

  return <RowActions actions={actions} label={`Ações de ${insurer.name}`} />
}

export function InsurersTable({
  insurers,
  procedures,
}: {
  insurers: InsurerView[]
  procedures: ProcedureOption[]
}) {
  if (insurers.length === 0) {
    return (
      <EmptyState
        title="Nenhum convênio cadastrado"
        description="Cadastre os convênios com quem a clínica fatura, o limite de guias por paciente no mês e os procedimentos que cada um cobre."
      />
    )
  }

  const nomePorProcedimento = new Map(procedures.map((p) => [p.id, p.name]))

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Convênio</TableHead>
          <TableHead>Cobre</TableHead>
          <TableHead className="text-right">Guias/mês</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Atendimentos</TableHead>
          <TableHead className="hidden lg:table-cell">Contato</TableHead>
          <TableHead className="w-1" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {insurers.map((i) => (
          <TableRow key={i.id}>
            <TableCell className="font-medium">
              <div className="flex flex-wrap items-center gap-2">
                {i.name}
                {!i.active && <Badge variant="secondary">Inativo</Badge>}
              </div>
            </TableCell>
            <TableCell className="text-[0.8rem] text-muted-foreground">
              {i.procedureIds.length === 0
                ? "Qualquer procedimento"
                : i.procedureIds
                    .map((id) => nomePorProcedimento.get(id))
                    .filter(Boolean)
                    .join(", ")}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {i.max_guides_per_patient_month ?? (
                <span className="text-muted-foreground">sem limite</span>
              )}
            </TableCell>
            <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">
              {i.appointmentsCount}
            </TableCell>
            <TableCell className="hidden text-[0.8rem] text-muted-foreground lg:table-cell">
              {i.contact_name || i.contact_email || i.contact_phone || "—"}
            </TableCell>
            <TableCell>
              <InsurerRowActions insurer={i} procedures={procedures} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
