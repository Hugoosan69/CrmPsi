import { EmptyState } from "@/components/shared/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ToggleActiveButton } from "@/components/shared/toggle-active-button"
import type { SessionPackageView } from "@/services/packages.service"
import { setSessionPackageActiveAction } from "../actions/package.actions"
import { EditPackageDialog } from "./edit-package-dialog"
import { ReprocessBalancesButton } from "./reprocess-balances-button"

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
          <TableHead>Especialidade</TableHead>
          <TableHead>Sessões</TableHead>
          <TableHead>Valor total</TableHead>
          <TableHead>Valor por sessão</TableHead>
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
            <TableCell>{p.specialtyName}</TableCell>
            <TableCell>{p.total_sessions}x</TableCell>
            <TableCell>{formatCurrency(Number(p.total_price))}</TableCell>
            <TableCell>{formatCurrency(Number(p.price_per_session))}</TableCell>
            <TableCell className="flex justify-end gap-1 text-right">
              <EditPackageDialog sessionPackage={p} specialties={specialties} />
              <ReprocessBalancesButton packageId={p.id} />
              <ToggleActiveButton
                active={p.active}
                deactivateLabel="Inativar"
                confirmTitle={p.active ? "Inativar pacote?" : "Ativar pacote?"}
                confirmDescription={
                  p.active
                    ? "O pacote deixará de aparecer para novas vendas."
                    : "O pacote voltará a aparecer para novas vendas."
                }
                action={setSessionPackageActiveAction.bind(null, p.id, !p.active)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
