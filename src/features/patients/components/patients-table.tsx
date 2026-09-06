import Link from "next/link"
import { PhoneOff } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { StatusDot } from "@/components/shared/status-dot"
import { PatientRowActions } from "./patient-row-actions"
import type { PatientWithStats } from "@/services/patients.service"

/** `birth_date` é um `date` puro (YYYY-MM-DD): partido na mão, sem passar por `Date`, que
 *  interpretaria a string como UTC e mostraria o dia anterior no fuso da clínica. */
function formatBirthDate(value: string | null) {
  if (!value) return null
  const [year, month, day] = value.split("-")
  if (!year || !month || !day) return null
  return `${day}/${month}/${year}`
}

function ageFrom(value: string | null): number | null {
  if (!value) return null
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return null
  const today = new Date()
  let age = today.getFullYear() - year
  const hadBirthday =
    today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day)
  if (!hadBirthday) age -= 1
  return age >= 0 && age < 130 ? age : null
}

function formatDay(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
}

/** "há 3 dias" / "em 2 dias" — a recepção lê recência melhor que data absoluta. */
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

export function PatientsTable({
  patients,
  profileBasePath,
}: {
  patients: PatientWithStats[]
  profileBasePath: string
}) {
  if (patients.length === 0) {
    return (
      <EmptyState
        title="Nenhum paciente encontrado"
        description="Ajuste a busca ou os filtros para ver outros cadastros."
      />
    )
  }

  return (
    <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Paciente</TableHead>
            <TableHead className="hidden md:table-cell">Nascimento</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>Pacote</TableHead>
            <TableHead className="hidden lg:table-cell">Último atendimento</TableHead>
            <TableHead className="hidden lg:table-cell">Próximo</TableHead>
            <TableHead className="w-1" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {patients.map((patient) => {
            const age = ageFrom(patient.birth_date)
            const contact = patient.phone || patient.whatsapp
            const lastDay = formatDay(patient.lastVisitAt)
            const nextDay = formatDay(patient.nextVisitAt)

            return (
              <TableRow key={patient.id}>
                <TableCell className="font-medium">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`${profileBasePath}/${patient.id}`}
                      className="hover:underline"
                    >
                      {patient.social_name || patient.full_name}
                    </Link>
                    {!patient.active && <Badge variant="secondary">Inativo</Badge>}
                  </div>
                  {patient.cpf && (
                    <span className="text-[0.75rem] font-normal text-muted-foreground tabular-nums">
                      {patient.cpf}
                    </span>
                  )}
                </TableCell>

                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {formatBirthDate(patient.birth_date) ? (
                    <span className="tabular-nums">
                      {formatBirthDate(patient.birth_date)}
                      {age !== null && (
                        <span className="ml-1.5 text-[0.75rem]">({age} anos)</span>
                      )}
                    </span>
                  ) : (
                    <Muted />
                  )}
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {contact ? (
                    <span className="tabular-nums">{contact}</span>
                  ) : (
                    // Sem contato o paciente fica fora de confirmação e lembrete — é a
                    // mesma anomalia listada em /gestao/anomalias, marcada aqui na origem.
                    <span className="inline-flex items-center gap-1.5 text-status-warning">
                      <PhoneOff className="size-3.5" aria-hidden />
                      <span className="text-[0.8rem] font-medium">Sem contato</span>
                    </span>
                  )}
                </TableCell>

                <TableCell>
                  {patient.activePackages > 0 ? (
                    <Badge variant="outline">
                      {patient.sessionsLeft} {patient.sessionsLeft === 1 ? "sessão" : "sessões"}
                      {patient.activePackages > 1 && ` · ${patient.activePackages} pacotes`}
                    </Badge>
                  ) : (
                    <Muted />
                  )}
                </TableCell>

                <TableCell className="hidden lg:table-cell">
                  {lastDay ? (
                    <span className="text-muted-foreground">
                      <span className="tabular-nums">{lastDay}</span>
                      <span className="ml-1.5 text-[0.75rem]">
                        {relativeDays(patient.lastVisitAt)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[0.8rem] text-muted-foreground">Nunca atendido</span>
                  )}
                </TableCell>

                <TableCell className="hidden lg:table-cell">
                  {nextDay ? (
                    <StatusDot
                      tone="info"
                      label={`${nextDay} · ${relativeDays(patient.nextVisitAt)}`}
                    />
                  ) : (
                    <Muted />
                  )}
                </TableCell>

            <TableCell>
              <PatientRowActions patient={patient} />
            </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
    </Table>
  )
}
