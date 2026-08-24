import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import { ComingSoon } from "@/components/shared/coming-soon"

export default async function ConfiguracoesPage() {
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE)
  return (
    <ComingSoon
      title="Configurações"
      phase="uma próxima fase"
      description="Horário de funcionamento, duração padrão de consulta e demais preferências da clínica."
    />
  )
}
