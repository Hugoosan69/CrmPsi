import { supabaseEnvStatus } from "@/lib/supabase/env"

/**
 * Shown instead of an opaque "A server error occurred" when the deployment is missing
 * its Supabase configuration. A misconfigured environment should explain itself —
 * naming the exact variables that are absent turns a 20-minute hunt into a 1-minute fix.
 *
 * Only reports presence, never values.
 */
export function ConfigurationRequired() {
  const env = supabaseEnvStatus()
  const vars = [
    { name: "NEXT_PUBLIC_SUPABASE_URL", present: env.url },
    { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", present: env.anonKey },
    { name: "SUPABASE_SERVICE_ROLE_KEY", present: env.serviceRoleKey },
  ]

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-7 shadow-card">
        <p className="text-[0.66rem] font-semibold tracking-[0.1em] text-status-warning uppercase">
          Configuração incompleta
        </p>
        <h1 className="mt-2 font-heading text-xl font-semibold">
          O sistema não está conectado ao banco de dados
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Estas variáveis de ambiente precisam estar definidas onde a aplicação está
          hospedada:
        </p>

        <ul className="mt-4 grid gap-2">
          {vars.map((v) => (
            <li
              key={v.name}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2"
            >
              <code className="font-mono text-[0.78rem]">{v.name}</code>
              <span
                className={
                  v.present
                    ? "shrink-0 text-[0.72rem] font-medium text-status-success"
                    : "shrink-0 text-[0.72rem] font-medium text-status-danger"
                }
              >
                {v.present ? "definida" : "AUSENTE"}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-5 rounded-lg bg-secondary/60 p-3 text-[0.8rem] text-secondary-foreground">
          <p className="font-medium">Na Vercel</p>
          <p className="mt-1 text-muted-foreground">
            Settings → Environment Variables. Marque <strong>Production</strong> e faça um novo
            deploy — variáveis adicionadas depois de um build não entram no que já foi
            construído.
          </p>
        </div>

        <p className="mt-4 text-[0.75rem] text-muted-foreground">
          Diagnóstico detalhado em <code className="font-mono">/api/health</code>.
        </p>
      </div>
    </div>
  )
}
