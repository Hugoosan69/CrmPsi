import {
  CalendarDays,
  Layers,
  LayoutDashboard,
  ListOrdered,
  MessageSquare,
  MessagesSquare,
  Package,
  Settings,
  ShieldCheck,
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
  "/gestao/profissionais": UsersRound,
  "/gestao/comunicacao": MessageSquare,
  "/gestao/procedimentos": Package,
  // Camadas em vez de outra caixa: "pacote" aqui é um conjunto de sessões, e reusar o
  // ícone de Procedimentos deixaria os dois itens indistinguíveis na barra estreita.
  "/gestao/pacotes": Layers,
  "/gestao/usuarios": Users,
  "/gestao/permissoes": ShieldCheck,
  "/gestao/configuracoes": Settings,
}
