import { notFound, redirect } from "next/navigation"

import { requireAreaAccess } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { getProfessionalByUserId } from "@/services/professionals.service"
import { hasProfessionalLink } from "@/services/professional-links.service"
import { PatientProfile } from "@/features/patients/components/patient-profile"

/**
 * O profissional só acessa a ficha de um paciente com quem tem vínculo
 * (via agendamento ou manual). Sem vínculo → 404, não forbidden: o profissional
 * nem deveria saber que o paciente existe (LGPD, dado sensível de saúde mental).
 */
export default async function ProfissionalPatientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const membership = await requireAreaAccess(
    PERMISSIONS.PROFESSIONAL_ACCESS,
    PERMISSIONS.PATIENTS_VIEW
  )
  const supabase = await createClient()

  const professional = await getProfessionalByUserId(
    supabase,
    membership.clinicId,
    membership.userId
  )
  if (!professional) redirect("/dashboard?error=no-professional")

  const hasLink = await hasProfessionalLink(
    supabase,
    membership.clinicId,
    professional.id,
    id
  )
  if (!hasLink) notFound()

  return <PatientProfile patientId={id} />
}
