"use client"

import { useTransition } from "react"
import { FlaskConical } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toggleSandboxAction } from "../actions/sandbox.actions"

export function SandboxToggle({ active }: { active: boolean }) {
  const [pending, startTransition] = useTransition()

  function toggle() {
    startTransition(async () => {
      const result = await toggleSandboxAction(!active)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.success)
        window.location.reload()
      }
    })
  }

  return (
    <Button
      variant={active ? "destructive" : "outline"}
      size="sm"
      className={cn("gap-2", !active && "border-status-warning/40 text-status-warning hover:bg-status-warning/10")}
      onClick={toggle}
      disabled={pending}
    >
      <FlaskConical className="size-4" />
      {active ? "Desativar sandbox" : "Ativar sandbox"}
    </Button>
  )
}
