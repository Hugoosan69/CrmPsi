export function PackageProgressBar({
  used,
  total,
  className,
}: {
  used: number
  total: number
  className?: string
}) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const isLast = total > 0 && used === total - 1

  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className={isLast ? "font-medium text-amber-600" : "text-muted-foreground"}>
          {used}/{total} sessões usadas
        </span>
        {isLast && <span className="font-medium text-amber-600">Última sessão do pacote</span>}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={isLast ? "h-full bg-amber-500" : "h-full bg-primary"}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
