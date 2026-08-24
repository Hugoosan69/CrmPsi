"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { TransactionView } from "@/services/financial.service"
import { TransactionsTable } from "./transactions-table"

type PaymentMethod = { id: string; name: string }

export function FinancialTabs({
  transactions,
  paymentMethods,
  canManage,
}: {
  transactions: TransactionView[]
  paymentMethods: PaymentMethod[]
  canManage: boolean
}) {
  const receitas = transactions.filter((t) => t.type === "receita")
  const despesas = transactions.filter((t) => t.type === "despesa")
  const pendentes = transactions.filter((t) => t.status === "pendente" || t.status === "atrasado")

  return (
    <Tabs defaultValue="pendentes">
      <TabsList>
        <TabsTrigger value="pendentes">Contas pendentes ({pendentes.length})</TabsTrigger>
        <TabsTrigger value="receitas">Receitas</TabsTrigger>
        <TabsTrigger value="despesas">Despesas</TabsTrigger>
      </TabsList>
      <TabsContent value="pendentes" className="mt-4">
        <TransactionsTable transactions={pendentes} paymentMethods={paymentMethods} canManage={canManage} />
      </TabsContent>
      <TabsContent value="receitas" className="mt-4">
        <TransactionsTable transactions={receitas} paymentMethods={paymentMethods} canManage={canManage} />
      </TabsContent>
      <TabsContent value="despesas" className="mt-4">
        <TransactionsTable transactions={despesas} paymentMethods={paymentMethods} canManage={canManage} />
      </TabsContent>
    </Tabs>
  )
}
