"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import { sessionPackageSchema, sellPackageSchema, retroactiveLinkSchema } from "@/schemas/package.schema"
import {
  createSessionPackage,
  updateSessionPackage,
  setSessionPackageActive,
  sellPackage,
  linkRetroactiveSession,
  linkAppointmentToPackage,
  createPatientPackageWithoutCharge,
  listActivePatientPackages,
  listSessionPackages,
  takenSessionNumbers,
} from "@/services/packages.service"
import { getAppointment } from "@/services/scheduling.service"
import { recordAudit } from "@/services/audit.service"
import { describeDbError } from "@/lib/db-errors"

export type PackageActionState = { error?: string; success?: boolean }

function revalidatePackages(patientId?: string) {
  revalidatePath("/gestao/pacotes")
  if (patientId) {
    revalidatePath(`/recepcao/pacientes/${patientId}`)
    revalidatePath(`/profissional/pacientes/${patientId}`)
  }
}

export async function createSessionPackageAction(
  _prev: PackageActionState,
  formData: FormData
): Promise<PackageActionState> {
  const membership = await requirePermission(PERMISSIONS.PACKAGES_MANAGE)

  const parsed = sessionPackageSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createClient()
  let id: string
  try {
    id = await createSessionPackage(supabase, membership.clinicId, parsed.data)
  } catch (err) {
    return { error: describeDbError(err) }
  }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "package.catalog.create",
    entityType: "session_package",
    entityId: id,
    after: parsed.data,
  })

  revalidatePackages()
  return { success: true }
}

export async function updateSessionPackageAction(
  packageId: string,
  _prev: PackageActionState,
  formData: FormData
): Promise<PackageActionState> {
  const membership = await requirePermission(PERMISSIONS.PACKAGES_MANAGE)

  const parsed = sessionPackageSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createClient()
  try {
    await updateSessionPackage(supabase, membership.clinicId, packageId, parsed.data)
  } catch (err) {
    return { error: describeDbError(err) }
  }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "package.catalog.update",
    entityType: "session_package",
    entityId: packageId,
    after: parsed.data,
  })

  revalidatePackages()
  return { success: true }
}

export async function setSessionPackageActiveAction(packageId: string, active: boolean) {
  const membership = await requirePermission(PERMISSIONS.PACKAGES_MANAGE)
  const supabase = await createClient()
  await setSessionPackageActive(supabase, membership.clinicId, packageId, active)

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: active ? "package.catalog.activate" : "package.catalog.deactivate",
    entityType: "session_package",
    entityId: packageId,
  })

  revalidatePackages()
}

export async function sellPackageAction(
  patientId: string,
  _prev: PackageActionState,
  formData: FormData
): Promise<PackageActionState> {
  const membership = await requirePermission(PERMISSIONS.PACKAGES_MANAGE)

  const parsed = sellPackageSchema.safeParse({ ...Object.fromEntries(formData), patient_id: patientId })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createClient()
  let patientPackageId: string
  try {
    patientPackageId = await sellPackage(supabase, membership.clinicId, {
      patientId: parsed.data.patient_id,
      sessionPackageId: parsed.data.session_package_id,
      paymentMethodId: parsed.data.payment_method_id,
      createdBy: membership.userId,
      notes: parsed.data.notes,
    })
  } catch (err) {
    return { error: describeDbError(err) }
  }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "package.sell",
    entityType: "patient_package",
    entityId: patientPackageId,
    after: parsed.data,
  })

  revalidatePackages(patientId)
  revalidatePath("/recepcao/financeiro")
  revalidatePath("/gestao/financeiro")
  return { success: true }
}

/**
 * Alimenta o seletor "Usar sessão do pacote" no formulário de agendamento — chamado do
 * client component quando o paciente é escolhido no PatientCombobox. Só exige
 * PACKAGES_VIEW (é leitura), diferente das demais ações deste arquivo.
 */
export async function listPatientActivePackagesAction(patientId: string) {
  const membership = await requirePermission(PERMISSIONS.PACKAGES_VIEW)
  const supabase = await createClient()
  const packages = await listActivePatientPackages(supabase, membership.clinicId, patientId)
  return packages
    .filter((p) => p.sessions_used < p.total_sessions)
    .map((p) => ({
      id: p.id,
      label: `${p.specialtyName} — ${p.packageName} (${p.sessions_used}/${p.total_sessions})`,
      remaining: p.total_sessions - p.sessions_used,
    }))
}

/**
 * Vincula um agendamento existente a um pacote, direto da agenda.
 *
 * **Não cobra nada.** Este vínculo é correção de registro: a consulta já estava marcada (e
 * muitas vezes já aconteceu) e o pacote do paciente já foi pago — o que faltava era o
 * sistema saber disso. Quando o paciente ainda não tem o saldo cadastrado, o pacote é
 * criado sem lançamento financeiro. A venda com cobrança continua sendo a da ficha do
 * paciente ("Vender pacote").
 */
export async function linkAppointmentToPackageAction(
  appointmentId: string,
  _prev: PackageActionState,
  formData: FormData
): Promise<PackageActionState> {
  const membership = await requirePermission(PERMISSIONS.PACKAGES_MANAGE)
  const supabase = await createClient()

  const existingPackageId = String(formData.get("patient_package_id") ?? "")
  const newPackageId = String(formData.get("session_package_id") ?? "")
  const rawSessionNumber = String(formData.get("session_number") ?? "")
  const sessionNumber = rawSessionNumber ? Number(rawSessionNumber) : undefined
  if (rawSessionNumber && (!Number.isInteger(sessionNumber) || (sessionNumber ?? 0) < 1)) {
    return { error: "Informe qual sessão do pacote é esta." }
  }

  let appointment: Awaited<ReturnType<typeof getAppointment>>
  try {
    appointment = await getAppointment(supabase, membership.clinicId, appointmentId)
  } catch (err) {
    return { error: describeDbError(err) }
  }

  let patientPackageId = existingPackageId
  try {
    if (!patientPackageId) {
      if (!newPackageId) return { error: "Selecione um pacote." }
      patientPackageId = await createPatientPackageWithoutCharge(supabase, membership.clinicId, {
        patientId: appointment.patient_id,
        sessionPackageId: newPackageId,
      })
    }

    await linkAppointmentToPackage(supabase, membership.clinicId, {
      appointmentId,
      patientPackageId,
      alreadyHappened: appointment.status === "completed",
      sessionNumber,
    })
  } catch (err) {
    return { error: describeDbError(err) }
  }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "package.link_appointment",
    entityType: "appointment",
    entityId: appointmentId,
    after: { patientPackageId, createdPackage: !existingPackageId },
  })

  revalidatePath("/recepcao/agenda")
  revalidatePath("/profissional/agenda")
  revalidatePackages(appointment.patient_id)
  revalidatePath("/gestao/financeiro")
  revalidatePath("/recepcao/financeiro")
  return { success: true }
}

/**
 * Tudo que o diálogo de vínculo na agenda precisa, numa chamada só e sob demanda — a
 * agenda renderiza dezenas de blocos e carregar catálogo + saldo de cada paciente junto
 * com ela custaria caro para uma ação que se usa de vez em quando.
 *
 * Os rótulos dizem **qual sessão será**, não quanto custa: aqui não se vende nada, e o
 * preço só distrairia de "esta consulta é a 2ª das 4".
 */
export async function getAppointmentPackageOptionsAction(appointmentId: string) {
  const membership = await requirePermission(PERMISSIONS.PACKAGES_MANAGE)
  const supabase = await createClient()

  const appointment = await getAppointment(supabase, membership.clinicId, appointmentId)
  const [patientPackages, catalog] = await Promise.all([
    listActivePatientPackages(supabase, membership.clinicId, appointment.patient_id),
    listSessionPackages(supabase, membership.clinicId, { activeOnly: true }),
  ])

  // `taken` alimenta o segundo campo do diálogo: as posições já registradas não podem ser
  // escolhidas de novo (o índice de migrations/018 é a garantia final).
  const withTakenSessions = await Promise.all(
    patientPackages
      .filter((p) => p.sessions_used < p.total_sessions)
      .map(async (p) => ({
        id: p.id,
        name: p.packageName,
        totalSessions: p.total_sessions,
        taken: await takenSessionNumbers(supabase, p.id),
      }))
  )

  return {
    patientPackages: withTakenSessions,
    catalog: catalog.map((p) => ({
      id: p.id,
      name: p.name,
      totalSessions: p.total_sessions,
      taken: [] as number[],
    })),
  }
}

/** Alimenta o diálogo de vínculo retroativo (requisito 6) com os pacotes já existentes
 * do paciente dono do lançamento. */
export async function listPatientPackagesForLinkAction(patientId: string) {
  const membership = await requirePermission(PERMISSIONS.PACKAGES_MANAGE)
  const supabase = await createClient()
  const packages = await listActivePatientPackages(supabase, membership.clinicId, patientId)
  return packages.map((p) => ({
    id: p.id,
    label: `${p.specialtyName} — ${p.packageName} (${p.sessions_used}/${p.total_sessions})`,
    suggestedSessionNumber: p.sessions_used + 1,
  }))
}

export async function linkRetroactiveSessionAction(
  _prev: PackageActionState,
  formData: FormData
): Promise<PackageActionState> {
  const membership = await requirePermission(PERMISSIONS.PACKAGES_MANAGE)

  const parsed = retroactiveLinkSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }
  if (!parsed.data.patient_package_id) {
    return { error: "Selecione o pacote ao qual esta sessão pertence." }
  }

  const supabase = await createClient()
  try {
    await linkRetroactiveSession(supabase, membership.clinicId, {
      transactionId: parsed.data.transaction_id,
      patientPackageId: parsed.data.patient_package_id,
      sessionNumber: parsed.data.session_number,
    })
  } catch (err) {
    return { error: describeDbError(err) }
  }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "package.retroactive_link",
    entityType: "financial_transaction",
    entityId: parsed.data.transaction_id,
    after: parsed.data,
  })

  revalidatePath("/gestao/financeiro")
  revalidatePath("/recepcao/financeiro")
  return { success: true }
}
