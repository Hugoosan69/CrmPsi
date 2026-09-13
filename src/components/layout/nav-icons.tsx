import {
  CalendarDays,
  Layers,
  LayoutDashboard,
  ListOrdered,
  MessageSquare,
  MessagesSquare,
  Package,
  Plug,
  Settings,
  ShieldCheck,
  Siren,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react"

/** Keyed by href so config/navigation.ts stays plain data — icons are a rendering
 * concern, not part of the permission/route model. */
export const NAV_ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/mensagens": MessagesSquare,
  "/recepcao/pacientes": Users,
  "/recepcao/agenda": CalendarDays,
  "/recepcao/fila": ListOrdered,
  "/recepcao/financeiro": Wallet,
  "/profissional/agenda": CalendarDays,
  "/profissional/fila": ListOrdered,
  "/profissional/financeiro": Wallet,
  "/gestao/financeiro": Wallet,
  // Sirene: a única entrada do menu que existe para dizer "algo saiu do esperado".
  // Deliberadamente longe de ShieldCheck (Permissões), que na barra estreita ficaria igual.
  "/gestao/anomalias": Siren,
  "/gestao/profissionais": UsersRound,
  "/gestao/comunicacao": MessageSquare,
  "/gestao/procedimentos": Package,
  // Camadas em vez de outra caixa: "pacote" aqui é um conjunto de sessões, e reusar o
  // ícone de Procedimentos deixaria os dois itens indistinguíveis na barra estreita.
  "/gestao/pacotes": Layers,
  "/gestao/usuarios": Users,
  "/gestao/permissoes": ShieldCheck,
  // Plugue: o que liga o sistema a serviços de fora (WAHA, n8n). Longe da engrenagem de
  // Configurações, que fica logo abaixo e seria confundida na barra estreita.
  "/gestao/integracoes": Plug,
  "/gestao/configuracoes": Settings,
}
