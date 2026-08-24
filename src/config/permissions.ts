// Mirrors database/99_seed/seed.sql. Keep in sync — this is the single place feature
// code references permission slugs from, instead of scattering string literals.
export const PERMISSIONS = {
  PATIENTS_VIEW: "patients.view",
  PATIENTS_MANAGE: "patients.manage",
  AGENDA_VIEW: "agenda.view",
  AGENDA_MANAGE: "agenda.manage",
  QUEUE_MANAGE: "queue.manage",
  SERVICE_MANAGE: "service.manage",
  RECORDS_VIEW: "records.view",
  DOCUMENTS_ISSUE: "documents.issue",
  FINANCIAL_VIEW: "financial.view",
  FINANCIAL_MANAGE: "financial.manage",
  USERS_MANAGE: "users.manage",
  SETTINGS_MANAGE: "settings.manage",
  AUDIT_VIEW: "audit.view",
} as const

export type PermissionSlug = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
