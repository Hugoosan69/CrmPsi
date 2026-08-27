import Link from "next/link"

import { Button } from "@/components/ui/button"

/**
 * The area index routes (/recepcao, /profissional, /gestao) and any mistyped URL used to
 * render Next's default 404. This keeps a wrong link inside the product.
 */
export default function NotFound() {
  return (
    <div className="mx-auto grid max-w-md gap-5 px-6 py-24 text-center">
      <div>
        <p className="metric font-heading text-5xl font-semibold text-muted-foreground/40">404</p>
        <h1 className="mt-3 font-heading text-xl font-semibold tracking-tight">
          Esta página não existe
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          O endereço pode ter mudado, ou o link que trouxe você até aqui está desatualizado.
        </p>
      </div>
      <div className="flex justify-center">
        <Button render={<Link href="/dashboard">Ir para o painel</Link>} />
      </div>
    </div>
  )
}
