"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import { createClinicalDocument } from "@/services/documents.service"
import { recordAudit } from "@/services/audit.service"
import type { ClinicalDocumentType } from "@/types/supabase"

export type DocumentActionState = { error?: string; success?: boolean; documentId?: string }

export async function issueClinicalDocumentAction(
  context: {
    patientId: string
    professionalId: string
    medicalRecordId: string | null
    queueEntryId?: string
  },
  _prev: DocumentActionState,
  formData: FormData
): Promise<DocumentActionState> {
  const membership = await requirePermission(PERMISSIONS.DOCUMENTS_ISSUE)

  const type = formData.get("type")
  const content = formData.get("content")
  const templateId = formData.get("template_id")

  if (typeof type !== "string" || !type) return { error: "Selecione o tipo de documento" }
  if (typeof content !== "string" || !content.trim()) return { error: "O conteúdo não pode ficar vazio" }

  const supabase = await createClient()
  const documentId = await createClinicalDocument(supabase, {
    clinicId: membership.clinicId,
    patientId: context.patientId,
    professionalId: context.professionalId,
    medicalRecordId: context.medicalRecordId,
    templateId: typeof templateId === "string" && templateId ? templateId : null,
    type: type as ClinicalDocumentType,
    content,
  })

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "document.issue",
    entityType: "clinical_document",
    entityId: documentId,
    after: { type },
  })

  if (context.queueEntryId) revalidatePath(`/profissional/atendimento/${context.queueEntryId}`)
  revalidatePath(`/profissional/pacientes/${context.patientId}`)
  revalidatePath(`/recepcao/pacientes/${context.patientId}`)
  return { success: true, documentId }
}
