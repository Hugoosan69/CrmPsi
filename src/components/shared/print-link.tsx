import Link from "next/link"
import { Printer } from "lucide-react"

/**
 * Link para a versão imprimível de um documento clínico.
 *
 * Abre em aba nova de propósito: quem imprime está no meio de um atendimento, e trocar a
 * tela atual pelo documento faria perder o que estava sendo digitado no prontuário.
 */
export function PrintLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener"
      aria-label={label}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[0.75rem] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Printer className="size-3.5" />
      Imprimir
    </Link>
  )
}
