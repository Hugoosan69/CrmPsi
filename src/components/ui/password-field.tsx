"use client"

import { useId, useState } from "react"
import { Eye, EyeOff } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/**
 * Password input with a reveal toggle.
 *
 * Worth the extra control specifically on "set a new password" screens: the operator is
 * typing a value they have never typed before, twice, with no feedback — and a typo they
 * cannot see means locking themselves out and starting the recovery flow again.
 */
export function PasswordField({
  name,
  label,
  hint,
  autoComplete = "new-password",
  minLength,
  required,
  autoFocus,
  className,
}: {
  name: string
  label: string
  hint?: string
  autoComplete?: string
  minLength?: number
  required?: boolean
  autoFocus?: boolean
  className?: string
}) {
  const id = useId()
  const [visible, setVisible] = useState(false)

  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={minLength}
          required={required}
          autoFocus={autoFocus}
          className="pr-9"
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {hint && <p className="text-[0.75rem] text-muted-foreground">{hint}</p>}
    </div>
  )
}
