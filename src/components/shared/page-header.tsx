import type { ReactNode } from "react"

/**
 * Standardized page header (title + short description + primary actions) — item 3/21.
 * Every page under (app) should render this once at the top instead of a hand-rolled
 * `<h1>` block, so title hierarchy and spacing stay consistent app-wide.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
