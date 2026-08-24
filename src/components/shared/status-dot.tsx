import { cn } from "@/lib/utils"

export type StatusTone = "neutral" | "info" | "warning" | "success" | "danger"

const DOT_CLASS: Record<StatusTone, string> = {
  neutral: "bg-status-neutral",
  info: "bg-status-info",
  warning: "bg-status-warning",
  success: "bg-status-success",
  danger: "bg-status-danger",
}

const TEXT_CLASS: Record<StatusTone, string> = {
  neutral: "text-muted-foreground",
  info: "text-status-info",
  warning: "text-status-warning",
  success: "text-status-success",
  danger: "text-status-danger",
}

/**
 * Item 20: every status shows a dot AND text — never colour alone. Reused across
 * agenda/fila/financeiro so the same five tones mean the same thing everywhere.
 * `pulse` adds a soft halo for genuinely live states only.
 */
export function StatusDot({
  tone,
  label,
  pulse = false,
  className,
}: {
  tone: StatusTone
  label: string
  pulse?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[0.8rem] font-medium whitespace-nowrap",
        TEXT_CLASS[tone],
        className
      )}
    >
      <span className="relative flex size-2 shrink-0 items-center justify-center" aria-hidden>
        {pulse && (
          <span
            className={cn("absolute inline-flex size-2 animate-ping rounded-full opacity-60", DOT_CLASS[tone])}
          />
        )}
        <span className={cn("relative inline-flex size-2 rounded-full", DOT_CLASS[tone])} />
      </span>
      {label}
    </span>
  )
}
