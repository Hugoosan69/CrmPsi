import { EmptyState } from "@/components/shared/empty-state"
import Link from "next/link"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { PatientWithStats } from "@/services/patients.service"
import { ToggleActiveButton } from "@/components/shared/toggle-active-button"
import { setPatientActiveAction } from "../actions/patient.actions"
import { EditPatientDialog } from "./edit-patient-dialog"

function formatDate(value: string | null) {
  if (!value) return "—"
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

function formatDateTime(isoString: string | null | undefined) {
  if (!isoString) return "—"
  const date = new Date(isoString)
  return date.toLocaleDateString("pt-BR")
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
      <EmptyState title="Nenhum paciente encontrado." />
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Telefone</TableHead>
          <TableHead>Pacotes ativos</TableHead>
          <TableHead>Último atendimento</TableHead>
          <TableHead>Especialidade</TableHead>
          <TableHead className="w-1" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {patients.map((patient) => (
          <TableRow key={patient.id}>
            <TableCell className="font-medium">
              <Link href={`${profileBasePath}/${patient.id}`} className="hover:underline">
                {patient.social_name || patient.full_name}
              </Link>
              {!patient.active && (
                <Badge variant="secondary" className="ml-2">
                  Inativo
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {patient.phone || patient.whatsapp || "—"}
            </TableCell>
            <TableCell>
              {patient.activePackagesCount > 0 ? (
                <Badge variant="outline">{patient.activePackagesCount} ativo(s)</Badge>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {formatDateTime(patient.lastAppointmentAt)}
            </TableCell>
            <TableCell className="text-sm">
              {patient.lastAppointmentSpecialty || "—"}
            </TableCell>
            <TableCell className="flex justify-end gap-1 text-right">
              <EditPatientDialog patient={patient} />
              <ToggleActiveButton
                active={patient.active}
                activateLabel="Ativar"
                deactivateLabel="Inativar"
                confirmTitle={patient.active ? "Inativar paciente?" : "Ativar paciente?"}
                confirmDescription={
                  patient.active
                    ? "O paciente deixará de aparecer nas buscas e listagens padrão."
                    : "O paciente voltará a aparecer nas buscas e listagens padrão."
                }
                action={setPatientActiveAction.bind(null, patient.id, !patient.active)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
