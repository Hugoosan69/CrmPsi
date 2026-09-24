import { FlaskConical } from "lucide-react"
import { isSandboxMode } from "@/lib/supabase/sandbox"

export async function SandboxBanner() {
  const active = await isSandboxMode()
  if (!active) return null

  return (
    <div className="flex items-center justify-center gap-2 bg-status-warning/20 px-4 py-1.5 text-[0.78rem] font-medium text-status-warning">
      <FlaskConical className="size-3.5" aria-hidden />
      SANDBOX — você está operando no banco de homologação
    </div>
  )
}
