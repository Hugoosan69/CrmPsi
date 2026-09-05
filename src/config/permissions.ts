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
  AUDIT_VIEW: "audit.view",

  // settings.manage passou a cobrir só identidade visual e ajustes gerais. As capacidades
  // abaixo saíram de dentro dela (migrations/009) porque uma permissão única obrigava a
  // liberar catálogo, agenda, equipe, mensageria E integrações de uma vez.
  SETTINGS_MANAGE: "settings.manage",
  CATALOG_MANAGE: "catalog.manage",
  AGENDA_CONFIGURE: "agenda.configure",
  PROFESSIONALS_MANAGE: "professionals.manage",
  COMMUNICATION_MANAGE: "communication.manage",

  /**
   * Acima de administrador, por peso e não por hierarquia formal: quem configura as
   * integrações controla o número de WhatsApp da clínica e, com pagamentos online, o destino
   * do dinheiro. Concedida apenas ao proprietário; um administrador que precise recebe por
   * exceção individual, caso a caso.
   */
  INTEGRATIONS_MANAGE: "integrations.manage",

  // migration 015 — pacotes de sessões.
  PACKAGES_VIEW: "packages.view",
  PACKAGES_MANAGE: "packages.manage",

  // migration 017 — o profissional vê só a movimentação dos próprios atendimentos.
  FINANCIAL_VIEW_OWN: "financial.view_own",

  // migration 019 — corrigir o valor de um lançamento já registrado (sempre auditado).
  FINANCIAL_EDIT_AMOUNT: "financial.edit_amount",
} as const

export type PermissionSlug = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
