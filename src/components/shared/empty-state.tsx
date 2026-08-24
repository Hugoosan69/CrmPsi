import Image from "next/image"
import type { ReactNode } from "react"

/**
 * Item 25: never leave a list area blank — small mascot, a title, one short line, and
 * an optional action. Item 24: the mascot appears here (and at login), not as constant
 * decoration, so the product still reads as professional.
 */
export function EmptyState({
  title,
  description,
  action,
  showMascot = true,
}: {
  title: string
  description?: string
  action?: ReactNode
  showMascot?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
      {showMascot && (
        <Image
          src="/branding/csib-mascote.svg"
          alt=""
          width={44}
          height={44}
          className="opacity-60 grayscale-[0.35]"
        />
      )}
      <div className="max-w-sm">
        <p className="font-heading text-[0.95rem] font-semibold text-foreground">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
