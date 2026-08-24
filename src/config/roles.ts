// Mirrors database/99_seed/seed.sql system roles.
export const ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  RECEPTIONIST: "receptionist",
  PROFESSIONAL: "professional",
  FINANCIAL: "financial",
} as const

export type RoleSlug = (typeof ROLES)[keyof typeof ROLES]

/** Which top-level area a role lands in after login (docs/ARCHITECTURE.md §7). */
export function defaultHomeForRole(roleSlug: string): string {
  switch (roleSlug) {
    case ROLES.PROFESSIONAL:
      return "/profissional/agenda"
    case ROLES.RECEPTIONIST:
      return "/recepcao/agenda"
    case ROLES.FINANCIAL:
      return "/gestao/financeiro"
    case ROLES.OWNER:
    case ROLES.ADMIN:
    default:
      return "/dashboard"
  }
}
