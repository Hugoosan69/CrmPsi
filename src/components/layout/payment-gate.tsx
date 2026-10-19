import { AlertTriangle } from "lucide-react"
import { getCurrentMembership } from "@/lib/auth/session"

const EXEMPT_EMAILS = ["hugoosan69@gmail.com", "thiagorc85@gmail.com"]
const BLOCK_DATE = new Date("2026-10-26T03:00:00Z") // domingo 25/10 meia-noite BRT

export async function PaymentGate({ children }: { children: React.ReactNode }) {
  const membership = await getCurrentMembership()
  if (!membership) return <>{children}</>

  const isExempt = EXEMPT_EMAILS.includes(membership.email.toLowerCase())
  const now = new Date()
  const isBlocked = now >= BLOCK_DATE && !isExempt

  if (isBlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-xl border border-destructive/30 bg-card p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-7 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold">Acesso temporariamente suspenso</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            O pagamento da mensalidade nao foi identificado e o acesso ao sistema foi
            suspenso. Para regularizar, entre em contato com o administrador da clínica.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-center gap-2 bg-destructive/10 px-4 py-2 text-[0.82rem] font-medium text-destructive">
        <AlertTriangle className="size-4 shrink-0" aria-hidden />
        <span>
          Pagamento pendente — o acesso ao sistema será suspenso caso o pagamento nao seja
          regularizado. Procure o administrador da clínica.
        </span>
      </div>
      {children}
    </>
  )
}
