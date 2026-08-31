import {
  CalendarDays,
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
  "/gestao/financeiro": Wallet,
  "/gestao/profissionais": UsersRound,
  "/gestao/comunicacao": MessageSquare,
  "/gestao/procedimentos": Package,
  "/gestao/usuarios": Users,
  "/gestao/permissoes": ShieldCheck,
  "/gestao/configuracoes": Settings,
}
