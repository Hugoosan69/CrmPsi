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

  // migration 020 — mexer numa linha JÁ PAGA. Exigida junto com FINANCIAL_EDIT_AMOUNT,
  // nunca sozinha: corrigir um lançamento em aberto é rotina, reescrever um recebimento já
  // conciliado é outra responsabilidade.
  FINANCIAL_EDIT_PAID: "financial.edit_paid",

  // migration 021 — cor de cada situação no card da agenda.
  AGENDA_APPEARANCE: "agenda.appearance",

  // migration 025 — teleconsulta. `view` acompanha quem já vê a agenda; `manage` — abrir a
  // sala, convidar o paciente e encerrar — acompanha quem conduz o atendimento e quem marca.
  TELEHEALTH_VIEW: "telehealth.view",
  TELEHEALTH_MANAGE: "telehealth.manage",

  // migrations 028/029 — convênios, guias e protocolo mensal. É assunto de dinheiro, não
  // de catálogo clínico: quem cadastra procedimento não decide com quem a clínica fatura.
  BILLING_VIEW: "billing.view",
  BILLING_MANAGE: "billing.manage",

  /**
   * migration 031 — ONDE a pessoa trabalha, e não o que ela pode fazer.
   *
   * Nenhuma das três autoriza ação alguma: elas decidem que áreas do sistema aparecem no
   * menu e quais rotas abrem. Existem porque a pergunta "esta pessoa trabalha no balcão?"
   * não tem resposta no conjunto de capacidades — o profissional precisa de
   * `patients.view`, `agenda.view` e `queue.manage` exatamente como a recepção, para
   * atender a própria fila, e era por isso que ele enxergava as telas do balcão.
   *
   * Regra ao usar: rota e menu exigem ÁREA + CAPACIDADE; Server Action exige só a
   * capacidade. Chamar o próximo paciente é a mesma ação venha do balcão ou do consultório,
   * e duplicar a checagem na action só criaria um segundo lugar para errar.
   */
  RECEPTION_ACCESS: "reception.access",
  PROFESSIONAL_ACCESS: "professional.access",
  MANAGEMENT_ACCESS: "management.access",
} as const

export type PermissionSlug = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
