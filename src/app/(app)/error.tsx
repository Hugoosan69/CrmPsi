"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { describeDbError, pendingMigrationFor } from "@/lib/db-errors"

/**
 * Every page under (app) is a Server Component that awaits Supabase, so a raw PostgREST
 * error used to surface as Next's default error screen — English, stack-shaped, and with
 * no way back. This turns the ones we recognise into the clinic's own language and, when
 * the cause is a schema that is behind, names the exact migration to run.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error("app error boundary", error)
  }, [error])

  const migration = pendingMigrationFor(error)
  const message = describeDbError(error)

  return (
    <div className="mx-auto grid max-w-xl gap-5 py-10">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive"
          aria-hidden
        >
          <AlertTriangle className="size-[1.1rem]" />
        </span>
        <div>
          <h1 className="font-heading text-xl font-semibold tracking-tight">
            {migration ? "Banco de dados desatualizado" : "Algo deu errado nesta tela"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{message}</p>
        </div>
      </div>

      {migration ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium">Como resolver</p>
          <ol className="mt-2 grid gap-1.5 text-sm text-muted-foreground">
            <li>1. Abra o SQL Editor do projeto no Supabase.</li>
            <li>
              2. Rode o conteúdo de{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8rem] text-foreground">
                database/migrations/{migration}
              </code>
              .
            </li>
            <li>3. Volte aqui e recarregue.</li>
          </ol>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button onClick={reset}>
          <RotateCcw className="size-4" />
          Tentar novamente
        </Button>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          Voltar ao painel
        </Button>
      </div>

      {error.digest ? (
        <p className="text-xs text-muted-foreground">
          Código para suporte: <span className="font-mono">{error.digest}</span>
        </p>
      ) : null}
    </div>
  )
}
