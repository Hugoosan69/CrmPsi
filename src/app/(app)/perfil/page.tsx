import { requireMembership } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { getOwnProfile } from "@/services/profile.service"
import { PageHeader } from "@/components/shared/page-header"
import { ProfileForm } from "@/features/profile/components/profile-form"

/** Own profile — no permission slug, every member edits their own record. */
export default async function PerfilPage() {
  const membership = await requireMembership()
  const supabase = await createClient()
  const profile = await getOwnProfile(supabase, membership.userId)

  return (
    <div className="grid animate-fade-in-up gap-6">
      <PageHeader title="Meu perfil" description="Seus dados de acesso e contato." />
      <ProfileForm
        fullName={profile.fullName}
        email={profile.email}
        phone={profile.phone}
        avatarUrl={profile.avatarUrl}
        roleName={membership.roleName}
        clinicName={membership.clinicName}
      />
    </div>
  )
}
