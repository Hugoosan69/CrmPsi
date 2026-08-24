import Link from "next/link"
import { AlertTriangle, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Database } from "@/types/supabase"

type Patient = Database["public"]["Tables"]["patients"]["Row"]
type ClinicalInfo = Database["public"]["Tables"]["patient_clinical_info"]["Row"] | null

function calculateAge(birthDate: string | null) {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  if (Number.isNaN(birth.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const hadBirthday =
    now.getMonth() > birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate())
  if (!hadBirthday) age -= 1
  return age
}

/**
 * The at-a-glance patient panel that sits beside the timer. Allergies get their own
 * alert treatment rather than being one more grey line — during a live appointment
 * that is the single fact most costly to miss.
 */
export function PatientSummaryCard({
  patient,
  clinicalInfo,
  profileHref,
}: {
  patient: Patient
  clinicalInfo: ClinicalInfo
  profileHref: string
}) {
  const age = calculateAge(patient.birth_date)
  const allergies = clinicalInfo?.allergies ?? []
  const conditions = clinicalInfo?.chronic_conditions ?? []
  const medications = clinicalInfo?.current_medications ?? []

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
      <p className="text-[0.66rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
        Dados do paciente
      </p>

      <p className="mt-2.5 font-heading text-[1.05rem] leading-tight font-semibold">
        {patient.social_name || patient.full_name}
      </p>
      <p className="text-[0.8rem] text-muted-foreground">
        {age !== null ? `${age} anos` : "Idade não informada"}
      </p>

      {allergies.length > 0 ? (
        <div className="mt-3.5 flex items-start gap-2 rounded-lg border border-status-danger/25 bg-status-danger/8 p-2.5">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-status-danger" aria-hidden />
          <div className="min-w-0">
            <p className="text-[0.7rem] font-semibold tracking-wide text-status-danger uppercase">
              Alergias
            </p>
            <p className="text-[0.82rem] text-foreground">{allergies.join(", ")}</p>
          </div>
        </div>
      ) : (
        <p className="mt-3.5 rounded-lg bg-muted/60 px-2.5 py-2 text-[0.78rem] text-muted-foreground">
          Nenhuma alergia registrada
        </p>
      )}

      <dl className="mt-3.5 grid gap-2 text-[0.82rem]">
        <Field label="CPF" value={patient.cpf} />
        <Field label="Telefone" value={patient.phone || patient.whatsapp} />
        {conditions.length > 0 && <Field label="Condições" value={conditions.join(", ")} />}
        {medications.length > 0 && <Field label="Medicamentos" value={medications.join(", ")} />}
      </dl>

      <Button
        variant="outline"
        size="sm"
        className="mt-4 w-full"
        nativeButton={false}
        render={
          <Link href={profileHref}>
            Histórico completo <ExternalLink className="size-3.5" />
          </Link>
        }
      />
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-medium">{value || "—"}</dd>
    </div>
  )
}
