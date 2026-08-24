import { PageHeader } from "./page-header"
import { EmptyState } from "./empty-state"

export function ComingSoon({
  title,
  phase,
  description,
}: {
  title: string
  phase: string
  description: string
}) {
  return (
    <div className="grid gap-6">
      <PageHeader title={title} />
      <EmptyState title={`Disponível na ${phase}`} description={description} />
    </div>
  )
}
