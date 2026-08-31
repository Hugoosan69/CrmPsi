"use server"

import { createClient } from "@/lib/supabase/server"
import { hasPermission, requireMembership } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import { NAV_SECTIONS, navItemVisible } from "@/config/navigation"
import { listPatients } from "@/services/patients.service"
import { listProfessionals } from "@/services/professionals.service"
import { listProcedures } from "@/services/procedures.service"

export type SearchHit = {
  id: string
  label: string
  detail: string | null
  href: string
}

export type SearchResults = {
  patients: SearchHit[]
  professionals: SearchHit[]
  procedures: SearchHit[]
  pages: SearchHit[]
}

const EMPTY: SearchResults = { patients: [], professionals: [], procedures: [], pages: [] }

/** Accent- and case-insensitive contains, so "jose" finds "José". */
function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

function matches(haystack: string | null | undefined, needle: string) {
  if (!haystack) return false
  return normalize(haystack).includes(needle)
}

/**
 * One search across the things an operator actually looks for mid-task: a patient, a
 * colleague, a procedure, or a screen. Every branch is permission-gated — the palette must
 * never become a way to discover records the role cannot open.
 *
 * Professionals and procedures are filtered in memory rather than queried: both are
 * clinic-sized tables already loaded on several screens, so a round trip per keystroke
 * would cost more than it saves. Patients go through the indexed search, since that table
 * grows without bound.
 */
export async function globalSearchAction(rawQuery: string): Promise<SearchResults> {
  const membership = await requireMembership()
  const query = rawQuery.trim()
  if (query.length < 2) return EMPTY

  const needle = normalize(query)
  const supabase = await createClient()

  const canSeePatients = hasPermission(membership, PERMISSIONS.PATIENTS_VIEW)
  const canManageCatalog = hasPermission(membership, PERMISSIONS.SETTINGS_MANAGE)
  const patientBase = hasPermission(membership, PERMISSIONS.SERVICE_MANAGE)
    ? "/profissional/pacientes"
    : "/recepcao/pacientes"

  const [patients, professionals, procedures] = await Promise.all([
    canSeePatients
      ? // A paleta mostra seis; buscar mais seria trabalho jogado fora a cada tecla.
        listPatients(supabase, membership.clinicId, { search: query, rangeEnd: 5 }).catch(
          () => ({ rows: [], total: 0 })
        )
      : Promise.resolve({ rows: [], total: 0 }),
    listProfessionals(supabase, membership.clinicId).catch(() => []),
    canManageCatalog
      ? listProcedures(supabase, membership.clinicId).catch(() => [])
      : Promise.resolve([]),
  ])

  // Screens the user can actually reach, so the palette doubles as navigation.
  const pages: SearchHit[] = NAV_SECTIONS.flatMap((section) =>
    section.items
      .filter((item) => navItemVisible(item, (slug) => hasPermission(membership, slug)))
      .filter((item) => matches(item.label, needle) || matches(section.title, needle))
      .map((item) => ({
        id: item.href,
        label: item.label,
        detail: section.title,
        href: item.href,
      }))
  )

  return {
    patients: patients.rows.map((p) => ({
      id: p.id,
      label: p.social_name || p.full_name,
      detail: [p.cpf, p.phone].filter(Boolean).join(" · ") || null,
      href: `${patientBase}/${p.id}`,
    })),
    professionals: professionals
      .filter((p) => p.active && matches(p.full_name, needle))
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        label: p.full_name,
        detail: p.professional_register || null,
        // Reception manages the roster; a professional without settings.manage lands on
        // the agenda filtered to that person instead of a page they cannot open.
        href: canManageCatalog
          ? "/gestao/profissionais"
          : `/recepcao/agenda?vista=semana&profissional=${p.id}`,
      })),
    procedures: procedures
      .filter((p) => p.active && matches(p.name, needle))
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        label: p.name,
        detail:
          p.price !== null && p.price !== undefined
            ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                Number(p.price)
              )
            : null,
        href: "/gestao/procedimentos",
      })),
    pages,
  }
}
