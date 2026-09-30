import Link from "next/link"

import { EmptyState } from "@/components/shared/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusDot } from "@/components/shared/status-dot"
import type { LinkedPatient } from "@/services/professional-links.service"

function formatDay(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  })
}

function relativeDays(iso: string | null): string | null {
  if (!iso) return null
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000)
  if (days === 0) return "hoje"
  if (days === 1) return "amanhã"
  if (days === -1) return "ontem"
  if (days > 0) return `em ${days} dias`
  const past = Math.abs(days)
  if (past < 30) return `há ${past} dias`
  if (past < 365) return `há ${Math.round(past / 30)} meses`
  return `há ${Math.floor(past / 365)} ano(s)`
}

function Muted() {
  return <span className="text-muted-foreground">—</span>
}

export function MyPatientsTable({ patients }: { patients: LinkedPatient[] }) {
  if (patients.length === 0) {
    return (
      <EmptyState
        title="Nenhum paciente vinculado"
        description="Quando você atender um paciente ou a recepção vincular um a você, ele aparecerá aqui."
      />
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Paciente</TableHead>
          <TableHead>Contato</TableHead>
          <TableHead className="hidden md:table-cell">Último atendimento</TableHead>
          <TableHead className="hidden md:table-cell">Próximo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {patients.map((patient) => {
          const contact = patient.phone || patient.whatsapp
          const lastDay = formatDay(patient.lastVisitAt)
          const nextDay = formatDay(patient.nextVisitAt)

          return (
            <TableRow key={patient.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/profissional/pacientes/${patient.id}`}
                  className="hover:underline"
                >
                  {patient.social_name || patient.full_name}
                </Link>
                {patient.cpf && (
                  <span className="ml-2 text-[0.75rem] font-normal text-muted-foreground tabular-nums">
                    {patient.cpf}
                  </span>
                )}
              </TableCell>

              <TableCell className="text-muted-foreground">
                {contact ? (
                  <span className="tabular-nums">{contact}</span>
                ) : (
                  <Muted />
                )}
              </TableCell>

              <TableCell className="hidden md:table-cell">
                {lastDay ? (
                  <span className="text-muted-foreground">
                    <span className="tabular-nums">{lastDay}</span>
                    <span className="ml-1.5 text-[0.75rem]">
                      {relativeDays(patient.lastVisitAt)}
                    </span>
                  </span>
                ) : (
                  <span className="text-[0.8rem] text-muted-foreground">
                    Nunca atendido
                  </span>
                )}
              </TableCell>

              <TableCell className="hidden md:table-cell">
                {nextDay ? (
                  <StatusDot
                    tone="info"
                    label={`${nextDay} · ${relativeDays(patient.nextVisitAt)}`}
                  />
                ) : (
                  <Muted />
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
