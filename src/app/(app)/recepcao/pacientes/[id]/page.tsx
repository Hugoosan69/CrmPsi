import { PatientProfile } from "@/features/patients/components/patient-profile"

export default async function RecepcaoPatientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <PatientProfile patientId={id} />
}
