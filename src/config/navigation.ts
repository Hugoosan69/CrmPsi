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
  /**
   * A área de trabalho a que esta seção pertence (migration 031). Sem ela a seção inteira
   * some, por mais capacidades que a pessoa tenha.
   *
   * Existe porque capacidade e lugar são perguntas diferentes: o profissional precisa de
   * `patients.view`, `agenda.view` e `queue.manage` para atender a própria fila, e era
   * essa coincidência que colocava o balcão inteiro no menu dele.
   *
   * `null` em Geral: o Painel é de todo mundo — o que ele MOSTRA é que varia, e isso é
   * decidido lá dentro, indicador por indicador.
   */
  area: string | null
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

/** A seção aparece? A área é um AND sobre os itens, não um atalho para eles. */
export function navSectionVisible(
  section: NavSection,
  has: (slug: string) => boolean
): boolean {
  if (section.area !== null && !has(section.area)) return false
  return section.items.some((item) => navItemVisible(item, has))
}

/**
 * O menu de uma pessoa: seções cujas áreas ela tem, com os itens que ela pode abrir.
 *
 * É a ÚNICA forma de percorrer `NAV_SECTIONS` filtrando — o layout e a busca faziam o
 * filtro cada um por si, e o comentário acima registra o preço que essa duplicação já
 * cobrou uma vez. Com a área entrando na conta, repeti-la seria a mesma armadilha: a busca
 * continuaria oferecendo, e abrindo, as telas do balcão para o profissional.
 */
export function visibleNavSections(has: (slug: string) => boolean): NavSection[] {
  return NAV_SECTIONS.filter((section) => navSectionVisible(section, has)).map((section) => ({
    ...section,
    items: section.items.filter((item) => navItemVisible(item, has)),
  }))
}

/**
 * One list per operating area (docs/ARCHITECTURE.md §7). A user only sees the sections
 * relevant to their permissions — filtered in AppSidebar, never assumed from role alone,
 * since a role is just a bundle of permissions and permissions are the real gate.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Geral",
    area: null,
    items: [{ href: "/dashboard", label: "Painel", permission: null }],
  },
  {
    title: "Recepção",
    area: PERMISSIONS.RECEPTION_ACCESS,
    items: [
      { href: "/recepcao/pacientes", label: "Pacientes", permission: PERMISSIONS.PATIENTS_VIEW },
      { href: "/recepcao/agenda", label: "Agenda", permission: PERMISSIONS.AGENDA_VIEW },
      { href: "/recepcao/fila", label: "Fila", permission: PERMISSIONS.QUEUE_MANAGE },
      { href: "/recepcao/financeiro", label: "Financeiro", permission: PERMISSIONS.FINANCIAL_VIEW },
    ],
  },
  {
    title: "Profissional",
    area: PERMISSIONS.PROFESSIONAL_ACCESS,
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
    area: PERMISSIONS.MANAGEMENT_ACCESS,
    items: [
      { href: "/gestao/financeiro", label: "Financeiro", permission: PERMISSIONS.FINANCIAL_VIEW },
      // Não é tela financeira: cruza fila, agenda, pacotes e cadastro. `audit.view` já é a
      // permissão de "olhar o que o sistema registrou sobre si mesmo" — proprietário e
      // administrador. Quem opera o balcão vê a anomalia crítica da fila na própria Fila.
      { href: "/gestao/anomalias", label: "Anomalias de processo", permission: PERMISSIONS.AUDIT_VIEW },
      {
        href: "/gestao/profissionais",
        label: "Profissionais",
        permission: [PERMISSIONS.PROFESSIONALS_MANAGE, PERMISSIONS.AGENDA_CONFIGURE],
      },
      { href: "/gestao/comunicacao", label: "Comunicação", permission: PERMISSIONS.COMMUNICATION_MANAGE },
      { href: "/gestao/procedimentos", label: "Procedimentos", permission: PERMISSIONS.CATALOG_MANAGE },
      {
        href: "/gestao/pacotes",
        label: "Pacotes e convênios",
        // `billing.view` entra porque a aba de guias emitidas exige só ela: conferir o que
        // foi emitido é rotina de quem fecha a cobrança, e não precisa vir com o poder de
        // editar o cadastro do convênio.
        permission: [
          PERMISSIONS.PACKAGES_MANAGE,
          PERMISSIONS.BILLING_MANAGE,
          PERMISSIONS.BILLING_VIEW,
        ],
      },
      { href: "/gestao/usuarios", label: "Usuários", permission: PERMISSIONS.USERS_MANAGE },
      { href: "/gestao/permissoes", label: "Permissões", permission: PERMISSIONS.USERS_MANAGE },
      { href: "/gestao/configuracoes", label: "Configurações", permission: PERMISSIONS.SETTINGS_MANAGE },
    ],
  },
]
