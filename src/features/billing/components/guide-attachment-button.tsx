"use client"

import { useState, useTransition } from "react"
import { ExternalLink, Paperclip } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { guideAttachmentLinkAction } from "../actions/guide-attachment.actions"

/**
 * Abre o anexo de uma guia.
 *
 * O link não vem pronto na página: é pedido no clique. Um link assinado é uma credencial de
 * curta duração, e renderizar um por linha entregaria acesso a todos os anexos da tela de
 * uma vez — inclusive os que ninguém abriu. Ver `guideAttachmentLinkAction`.
 *
 * A aba é aberta ANTES do await, ainda dentro do gesto do clique, e só então recebe o
 * endereço. Abrir depois da resposta cai no bloqueador de pop-up de todos os navegadores:
 * a essa altura a chamada já não é mais atribuída ao clique do usuário.
 */
export function GuideAttachmentButton({
  guideId,
  label = "Ver guia",
}: {
  guideId: string
  label?: string
}) {
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function abrir() {
    const janela = window.open("", "_blank", "noopener,noreferrer")
    startTransition(async () => {
      setErro(null)
      const resultado = await guideAttachmentLinkAction(guideId)
      if (resultado.error || !resultado.url) {
        janela?.close()
        setErro(resultado.error ?? "Não foi possível abrir o anexo.")
        toast.error(resultado.error ?? "Não foi possível abrir o anexo.")
        return
      }
      if (janela) {
        janela.location.href = resultado.url
      } else {
        // Pop-up bloqueado mesmo assim: o link ainda é válido, então vale oferecê-lo em vez
        // de perder o que já foi assinado e auditado.
        window.location.href = resultado.url
      }
    })
  }

  return (
    <div className="grid gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={abrir}
        disabled={isPending}
        aria-label={`${label} (abre em nova aba)`}
      >
        {isPending ? (
          <>Abrindo…</>
        ) : (
          <>
            <Paperclip className="size-3.5" aria-hidden />
            {label}
            <ExternalLink className="size-3 opacity-60" aria-hidden />
          </>
        )}
      </Button>
      {erro && (
        <p className="text-[0.72rem] text-destructive" role="alert">
          {erro}
        </p>
      )}
    </div>
  )
}
