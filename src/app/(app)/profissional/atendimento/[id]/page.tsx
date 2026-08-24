import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { getProfessionalByUserId } from "@/services/professionals.service"
import { getQueueEntry } from "@/services/queue.service"
import { getPatient, getPatientClinicalInfo } from "@/services/patients.service"
import {
  getCidDescriptions,
  getOrCreateMedicalRecordForQueueEntry,
  listDiagnosesForRecord,
} from "@/services/records.service"
import { listDocumentTemplates } from "@/services/documents.service"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState } from "@/components/shared/empty-state"
import { PatientSummaryCard } from "@/features/patients/components/patient-summary-card"
import { PatientTimeline } from "@/features/patients/components/patient-timeline"
import { PatientPrescriptionsPanel } from "@/features/prescriptions/components/patient-prescriptions-panel"
import { PatientDocumentsPanel } from "@/features/documents/components/patient-documents-panel"
import { MedicalRecordForm } from "@/features/records/components/medical-record-form"
import { DiagnosesList } from "@/features/records/components/diagnoses-list"
import { PrescriptionBuilder } from "@/features/prescriptions/components/prescription-builder"
import { DocumentBuilder } from "@/features/documents/components/document-builder"
import { ServiceTimerPanel } from "@/features/service/components/service-timer-panel"
import { FinishServiceButton } from "@/features/service/components/finish-service-button"
import { formatDate } from "@/utils/datetime"

/**
 * The clinical workspace (items 10/12): everything a professional needs during a live
 * appointment on one screen — write on the left, consult on the centre, timer and
 * patient facts pinned on the right. No modals for clinical content, no navigating away.
 */
export default async function AtendimentoPage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requirePermission(PERMISSIONS.SERVICE_MANAGE)
  const { id: queueEntryId } = await params

  const supabase = await createClient()
  const professional = await getProfessionalByUserId(supabase, membership.clinicId, membership.userId)

  if (!professional) {
    return <EmptyState title="Sem cadastro de profissional vinculado" showMascot={false} />
  }

  const queueEntry = await getQueueEntry(supabase, membership.clinicId, queueEntryId)

  if (queueEntry.professional_id && queueEntry.professional_id !== professional.id) {
    return <EmptyState title="Este atendimento está atribuído a outro profissional" showMascot={false} />
  }

  const [patient, clinicalInfo, medicalRecord, templates] = await Promise.all([
    getPatient(supabase, membership.clinicId, queueEntry.patient_id),
    getPatientClinicalInfo(supabase, queueEntry.patient_id),
    getOrCreateMedicalRecordForQueueEntry(supabase, membership.clinicId, {
      queueEntryId,
      patientId: queueEntry.patient_id,
      professionalId: professional.id,
      appointmentId: queueEntry.appointment_id,
    }),
    listDocumentTemplates(supabase, membership.clinicId),
  ])

  const diagnoses = await listDiagnosesForRecord(supabase, medicalRecord.id)
  const cidDescriptions = await getCidDescriptions(supabase, diagnoses.map((d) => d.cid_code))

  const patientName = patient.social_name || patient.full_name
  const templateVars = {
    patient_name: patientName,
    patient_cpf: patient.cpf ?? "",
    professional_name: professional.full_name,
    professional_register: professional.professional_register ?? "",
    clinic_name: membership.clinicName,
    date: formatDate(new Date().toISOString()),
    days: "1",
  }

  return (
    <div className="grid gap-5">
      {/* Breadcrumb: one click back to the queue, and the patient's name always on screen. */}
      <nav className="flex items-center gap-1.5 text-[0.82rem]" aria-label="Trilha de navegação">
        <Link
          href="/profissional/fila"
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" /> Fila
        </Link>
        <span className="text-border" aria-hidden>
          /
        </span>
        <span className="text-muted-foreground">Atendimento</span>
        <span className="text-border" aria-hidden>
          /
        </span>
        <span className="font-medium text-foreground">{patientName}</span>
      </nav>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_300px]">
        {/* LEFT — where the professional writes. */}
        <section className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-soft">
          <div>
            <h2 className="font-heading text-[1rem] font-semibold">Registro do atendimento</h2>
            <p className="text-[0.8rem] text-muted-foreground">
              Salvo no prontuário do paciente ao clicar em salvar.
            </p>
          </div>

          <MedicalRecordForm
            medicalRecord={medicalRecord}
            queueEntryId={queueEntryId}
            patientId={patient.id}
          />

          <div className="grid gap-2 border-t border-border pt-4">
            <p className="text-[0.66rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
              Diagnóstico (CID)
            </p>
            <DiagnosesList
              medicalRecordId={medicalRecord.id}
              queueEntryId={queueEntryId}
              patientId={patient.id}
              diagnoses={diagnoses}
              cidDescriptions={cidDescriptions}
            />
          </div>
        </section>

        {/* CENTRE — what the professional consults, as tabs so nothing is buried. */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
          <Tabs defaultValue="prontuario">
            <TabsList>
              <TabsTrigger value="prontuario">Prontuário</TabsTrigger>
              <TabsTrigger value="prescricoes">Prescrições</TabsTrigger>
              <TabsTrigger value="documentos">Documentos</TabsTrigger>
            </TabsList>

            <TabsContent value="prontuario" className="mt-4">
              <PatientTimeline
                clinicId={membership.clinicId}
                patientId={patient.id}
                excludeRecordId={medicalRecord.id}
              />
            </TabsContent>

            <TabsContent value="prescricoes" className="mt-4 grid gap-4">
              <PrescriptionBuilder
                patientId={patient.id}
                professionalId={professional.id}
                medicalRecordId={medicalRecord.id}
                queueEntryId={queueEntryId}
              />
              <PatientPrescriptionsPanel clinicId={membership.clinicId} patientId={patient.id} />
            </TabsContent>

            <TabsContent value="documentos" className="mt-4 grid gap-4">
              <DocumentBuilder
                patientId={patient.id}
                professionalId={professional.id}
                medicalRecordId={medicalRecord.id}
                queueEntryId={queueEntryId}
                templates={templates}
                vars={templateVars}
              />
              <PatientDocumentsPanel clinicId={membership.clinicId} patientId={patient.id} />
            </TabsContent>
          </Tabs>
        </section>

        {/* RIGHT — pinned: the timer never scrolls out of view (item 8.7). */}
        <aside className="grid gap-4 xl:sticky xl:top-[4.75rem]">
          <ServiceTimerPanel queueEntryId={queueEntryId} />
          <PatientSummaryCard
            patient={patient}
            clinicalInfo={clinicalInfo}
            profileHref={`/profissional/pacientes/${patient.id}`}
          />
          <FinishServiceButton queueEntryId={queueEntryId} />
        </aside>
      </div>
    </div>
  )
}
