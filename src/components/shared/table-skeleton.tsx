import { Skeleton } from "@/components/ui/skeleton"

/** Item 26: replace bare "Carregando..." text with a shape that previews the content
 * about to arrive — reduces perceived latency, standard across every list/table. */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="grid gap-2">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex items-center gap-4 rounded-md border px-4 py-3">
          {Array.from({ length: columns }).map((_, col) => (
            <Skeleton key={col} className="h-4 flex-1" style={{ maxWidth: col === 0 ? "40%" : undefined }} />
          ))}
        </div>
      ))}
    </div>
  )
}
