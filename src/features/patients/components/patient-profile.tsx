import { notFound } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { requirePermission, hasPermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { getPatient, getPatientClinicalInfo } from "@/services/patients.service"
import { EditPatientDialog } from "./edit-patient-dialog"
import { ClinicalInfoCard } from "./clinical-info-card"
import { PatientTimeline } from "./patient-timeline"
import { PatientPrescriptionsPanel } from "@/features/prescriptions/components/patient-prescriptions-panel"
import { PatientDocumentsPanel } from "@/features/documents/components/patient-documents-panel"
import { PatientFinancialSummary } from "@/features/financial/components/patient-financial-summary"
import { PatientMessagesPanel } from "@/features/communication/components/patient-messages-panel"
import { formatDate as formatSaoPauloDate } from "@/utils/datetime"

function formatDate(value: string | null) {
  if (!value) return "—"
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

function calculateAge(birthDate: string | null) {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  if (Number.isNaN(birth.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const hasHadBirthdayThisYear =
    now.getMonth() > birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate())
  if (!hasHadBirthdayThisYear) age -= 1
  return age
}

/**
 * Shared between /recepcao/pacientes/[id] and /profissional/pacientes/[id]
 * (docs/ARCHITECTURE.md §7) — only the tabs each role can act on differ.
 * Agendamentos/Histórico/Prescrições/Atestados/Financeiro tabs join this component
 * as later phases (2-4) implement those domains.
 */
export async function PatientProfile({ patientId }: { patientId: string }) {
  const membership = await requirePermission(PERMISSIONS.PATIENTS_VIEW)
  const supabase = await createClient()

  let patient
  try {
    patient = await getPatient(supabase, membership.clinicId, patientId)
  } catch {
    notFound()
  }

  const clinicalInfo = await getPatientClinicalInfo(supabase, patientId)
  const canEditClinicalInfo = hasPermission(membership, PERMISSIONS.SERVICE_MANAGE)
  const canViewFinancial = hasPermission(membership, PERMISSIONS.FINANCIAL_VIEW)
  const canManageFinancial = hasPermission(membership, PERMISSIONS.FINANCIAL_MANAGE)
  const canMessage = hasPermission(membership, PERMISSIONS.PATIENTS_MANAGE)
  const age = calculateAge(patient.birth_date)

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {patient.social_name || patient.full_name}
            </h1>
            {!patient.active && <Badge variant="secondary">Inativo</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {age !== null ? `${age} anos` : "Idade não informada"}
            {patient.cpf ? ` · CPF ${patient.cpf}` : ""}
          </p>
        </div>
        <EditPatientDialog patient={patient} />
      </div>

      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">Dados pessoais</TabsTrigger>
          <TabsTrigger value="clinico">Informações clínicas</TabsTrigger>
          <TabsTrigger value="historico">Atendimentos</TabsTrigger>
          <TabsTrigger value="prescricoes">Prescrições</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          {canViewFinancial && <TabsTrigger value="financeiro">Financeiro</TabsTrigger>}
          {canMessage && <TabsTrigger value="mensagens">Mensagens</TabsTrigger>}
        </TabsList>
        <TabsContent value="dados" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados pessoais</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Nome completo" value={patient.full_name} />
              <Field label="Nome social" value={patient.social_name} />
              <Field label="Data de nascimento" value={formatDate(patient.birth_date)} />
              <Field label="Sexo" value={patient.sex} />
              <Field label="Nome da mãe" value={patient.mother_name} />
              <Field label="Telefone" value={patient.phone} />
              <Field label="WhatsApp" value={patient.whatsapp} />
              <Field label="E-mail" value={patient.email} />
              {patient.notes && (
                <div className="col-span-2">
                  <p className="mb-1 font-medium">Observações</p>
                  <p className="text-muted-foreground">{patient.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="clinico" className="mt-4">
          <ClinicalInfoCard patientId={patientId} info={clinicalInfo} canEdit={canEditClinicalInfo} />
        </TabsContent>
        <TabsContent value="historico" className="mt-4">
          <PatientTimeline clinicId={membership.clinicId} patientId={patientId} />
        </TabsContent>
        <TabsContent value="prescricoes" className="mt-4">
          <PatientPrescriptionsPanel clinicId={membership.clinicId} patientId={patientId} />
        </TabsContent>
        <TabsContent value="documentos" className="mt-4">
          <PatientDocumentsPanel clinicId={membership.clinicId} patientId={patientId} />
        </TabsContent>
        {canViewFinancial && (
          <TabsContent value="financeiro" className="mt-4">
            <PatientFinancialSummary
              clinicId={membership.clinicId}
              patientId={patientId}
              canManage={canManageFinancial}
            />
          </TabsContent>
        )}
        {canMessage && (
          <TabsContent value="mensagens" className="mt-4">
            <PatientMessagesPanel
              clinicId={membership.clinicId}
              patientId={patientId}
              vars={{
                patient_name: patient.social_name || patient.full_name,
                clinic_name: membership.clinicName,
                date: formatSaoPauloDate(new Date().toISOString()),
              }}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="mb-1 font-medium">{label}</p>
      <p className="text-muted-foreground">{value || "—"}</p>
    </div>
  )
}
