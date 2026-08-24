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
import type { Database } from "@/types/supabase"
import { ToggleActiveButton } from "@/components/shared/toggle-active-button"
import { setPatientActiveAction } from "../actions/patient.actions"
import { EditPatientDialog } from "./edit-patient-dialog"

type PatientRow = Database["public"]["Tables"]["patients"]["Row"]

function formatDate(value: string | null) {
  if (!value) return "—"
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

export function PatientsTable({
  patients,
  profileBasePath,
}: {
  patients: PatientRow[]
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
          <TableHead>CPF</TableHead>
          <TableHead>Nascimento</TableHead>
          <TableHead>Telefone</TableHead>
          <TableHead>WhatsApp</TableHead>
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
            <TableCell>{patient.cpf || "—"}</TableCell>
            <TableCell>{formatDate(patient.birth_date)}</TableCell>
            <TableCell>{patient.phone || "—"}</TableCell>
            <TableCell>{patient.whatsapp || "—"}</TableCell>
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
