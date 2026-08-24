import { PERMISSIONS } from "./permissions"

export type NavItem = {
  href: string
  label: string
  /** null = visible to anyone with an active membership (e.g. "Painel"). */
  permission: string | null
}

export type NavSection = {
  title: string
  items: NavItem[]
}

/**
 * One list per operating area (docs/ARCHITECTURE.md §7). A user only sees the sections
 * relevant to their permissions — filtered in AppSidebar, never assumed from role alone,
 * since a role is just a bundle of permissions and permissions are the real gate.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Geral",
    items: [{ href: "/dashboard", label: "Painel", permission: null }],
  },
  {
    title: "Recepção",
    items: [
      { href: "/recepcao/pacientes", label: "Pacientes", permission: PERMISSIONS.PATIENTS_VIEW },
      { href: "/recepcao/agenda", label: "Agenda", permission: PERMISSIONS.AGENDA_VIEW },
      { href: "/recepcao/fila", label: "Fila", permission: PERMISSIONS.QUEUE_MANAGE },
      { href: "/recepcao/financeiro", label: "Financeiro", permission: PERMISSIONS.FINANCIAL_VIEW },
    ],
  },
  {
    title: "Profissional",
    items: [
      { href: "/profissional/agenda", label: "Minha agenda", permission: PERMISSIONS.SERVICE_MANAGE },
      { href: "/profissional/fila", label: "Minha fila", permission: PERMISSIONS.SERVICE_MANAGE },
    ],
  },
  {
    title: "Gestão",
    items: [
      { href: "/gestao/financeiro", label: "Financeiro", permission: PERMISSIONS.FINANCIAL_VIEW },
      { href: "/gestao/profissionais", label: "Profissionais", permission: PERMISSIONS.SETTINGS_MANAGE },
      { href: "/gestao/comunicacao", label: "Comunicação", permission: PERMISSIONS.SETTINGS_MANAGE },
      { href: "/gestao/procedimentos", label: "Procedimentos", permission: PERMISSIONS.SETTINGS_MANAGE },
      { href: "/gestao/usuarios", label: "Usuários", permission: PERMISSIONS.USERS_MANAGE },
      { href: "/gestao/permissoes", label: "Permissões", permission: PERMISSIONS.USERS_MANAGE },
      { href: "/gestao/configuracoes", label: "Configurações", permission: PERMISSIONS.SETTINGS_MANAGE },
    ],
  },
]
