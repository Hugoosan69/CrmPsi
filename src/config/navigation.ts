import { PERMISSIONS } from "./permissions"

export type NavItem = {
  href: string
  label: string
  /**
   * null = visible to anyone with an active membership (e.g. "Painel").
   *
   * Uma lista significa "qualquer uma destas serve", e existe porque Profissionais reúne
   * dois assuntos: a equipe (`professionals.manage`) e a configuração da agenda dela
   * (`agenda.configure`). Exigir só a primeira deixaria quem tem apenas a segunda sem
   * nenhum caminho no menu — a tela existe para essa pessoa, com as abas dela.
   */
  permission: string | string[] | null
}

export type NavSection = {
  title: string
  items: NavItem[]
}

/**
 * Um item aparece? Módulo neutro de propósito: recebe a consulta de permissão em vez de
 * importar a sessão, para poder ser usado tanto pelo layout quanto pela busca.
 *
 * Existe centralizado porque estava duplicado nos dois lugares, e a duplicação já cobrou o
 * preço: ao passar `permission` a aceitar lista, um dos dois filtros deixou de compilar e o
 * outro teria continuado errado em silêncio se compilasse.
 */
export function navItemVisible(
  item: NavItem,
  has: (slug: string) => boolean
): boolean {
  if (item.permission === null) return true
  const exigidas = Array.isArray(item.permission) ? item.permission : [item.permission]
  return exigidas.some(has)
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
      {
        href: "/profissional/financeiro",
        label: "Meu financeiro",
        permission: PERMISSIONS.FINANCIAL_VIEW_OWN,
      },
    ],
  },
  {
    title: "Gestão",
    items: [
      { href: "/gestao/financeiro", label: "Financeiro", permission: PERMISSIONS.FINANCIAL_VIEW },
      {
        href: "/gestao/profissionais",
        label: "Profissionais",
        permission: [PERMISSIONS.PROFESSIONALS_MANAGE, PERMISSIONS.AGENDA_CONFIGURE],
      },
      { href: "/gestao/comunicacao", label: "Comunicação", permission: PERMISSIONS.COMMUNICATION_MANAGE },
      { href: "/gestao/procedimentos", label: "Procedimentos", permission: PERMISSIONS.CATALOG_MANAGE },
      { href: "/gestao/pacotes", label: "Pacotes", permission: PERMISSIONS.PACKAGES_MANAGE },
      { href: "/gestao/usuarios", label: "Usuários", permission: PERMISSIONS.USERS_MANAGE },
      { href: "/gestao/permissoes", label: "Permissões", permission: PERMISSIONS.USERS_MANAGE },
      { href: "/gestao/configuracoes", label: "Configurações", permission: PERMISSIONS.SETTINGS_MANAGE },
    ],
  },
]
