import { EmptyState } from "@/components/shared/empty-state"
import { PackageRowActions } from "./package-row-actions"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { SessionPackageView } from "@/services/packages.service"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

export function PackageCatalogTable({
  packages,
  specialties,
}: {
  packages: SessionPackageView[]
  specialties: { id: string; name: string }[]
}) {
  if (packages.length === 0) {
    return <EmptyState title="Nenhum pacote cadastrado." />
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead className="hidden md:table-cell">Especialidade</TableHead>
          <TableHead className="text-right">Sessões</TableHead>
          <TableHead className="text-right">Valor total</TableHead>
          <TableHead className="hidden text-right lg:table-cell">Valor por sessão</TableHead>
          <TableHead className="w-1" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {packages.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="font-medium">
              {p.name}
              {!p.active && (
                <Badge variant="secondary" className="ml-2">
                  Inativo
                </Badge>
              )}
            </TableCell>
            <TableCell className="hidden md:table-cell">{p.specialtyName}</TableCell>
            <TableCell className="text-right tabular-nums">
              {p.total_sessions}x
              {/* O período só ganha destaque quando NÃO é o padrão: "Mensal" em toda linha
                  vira ruído, e é justamente o quinzenal que muda a rotina de quem vende. */}
              {p.period === "quinzenal" && (
                <Badge variant="secondary" className="ml-2 font-normal">
                  Quinzenal
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCurrency(Number(p.total_price))}
              {/* O valor por sessão perde a coluna abaixo de `lg`, mas não a relevância:
                  é ele que a recepção confere ao vender. */}
              <p className="text-xs font-normal text-muted-foreground lg:hidden">
                {formatCurrency(Number(p.price_per_session))}/sessão
              </p>
            </TableCell>
            <TableCell className="hidden text-right tabular-nums lg:table-cell">
              {formatCurrency(Number(p.price_per_session))}
            </TableCell>
            <TableCell>
              <PackageRowActions sessionPackage={p} specialties={specialties} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
