"use client"

import { useState, useTransition } from "react"
import { Download, ExternalLink, Link2, Mail, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { RowActions, type RowAction } from "@/components/shared/row-actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { GuideRow } from "@/services/billing.service"
import {
  cancelGuideAction,
  guideAttachmentLinkAction,
  sendGuideByEmailAction,
} from "../actions/guide-attachment.actions"

/**
 * As ações de uma guia.
 *
 * Todas dependem de um link assinado gerado no servidor, no momento do clique — nunca
 * renderizado junto com a lista. Ver `guideAttachmentLinkAction`.
 *
 * ABRIR precisa de cuidado com o navegador: a aba é criada ANTES do `await`, ainda dentro
 * do gesto do clique. Aberta depois da resposta, ela já não é mais atribuída ao clique do
 * usuário e cai no bloqueador de pop-up de qualquer navegador. E se mesmo assim o pop-up
 * for bloqueado, o link fica à mão para ser clicado — o que NÃO se faz é navegar a aba
 * atual, que tiraria a pessoa da lista onde ela estava trabalhando.
 */
export function GuideRowActions({
  guide,
  canManage,
}: {
  guide: GuideRow
  canManage: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [linkDeReserva, setLinkDeReserva] = useState<string | null>(null)

  const semAnexo = !guide.attachmentKey

  function abrir() {
    const janela = window.open("", "_blank", "noopener,noreferrer")
    startTransition(async () => {
      const r = await guideAttachmentLinkAction(guide.id, "view")
      if (r.error || !r.url) {
        janela?.close()
        toast.error(r.error ?? "Não foi possível abrir a guia.")
        return
      }
      if (janela && !janela.closed) {
        janela.location.href = r.url
      } else {
        // Pop-up bloqueado. O link já foi assinado e auditado, então vale oferecê-lo em vez
        // de descartá-lo — e sem sequestrar a aba atual.
        setLinkDeReserva(r.url)
        toast.warning("Seu navegador bloqueou a nova aba. Use o link que apareceu na linha.")
      }
    })
  }

  function baixar() {
    startTransition(async () => {
      const r = await guideAttachmentLinkAction(guide.id, "download")
      if (r.error || !r.url) {
        toast.error(r.error ?? "Não foi possível baixar a guia.")
        return
      }
      // O link já carrega `content-disposition: attachment`, assinado junto: navegar até
      // ele baixa o arquivo sem trocar a página.
      window.location.href = r.url
    })
  }

  function copiarLink() {
    startTransition(async () => {
      const r = await guideAttachmentLinkAction(guide.id, "share")
      if (r.error || !r.url) {
        toast.error(r.error ?? "Não foi possível gerar o link.")
        return
      }
      try {
        await navigator.clipboard.writeText(r.url)
        toast.success("Link de 24 horas copiado. Depois disso ele deixa de funcionar.")
      } catch {
        // Área de transferência negada (permissão, http, navegador antigo): mostrar o link
        // é melhor do que perder o que já foi assinado.
        setLinkDeReserva(r.url)
        toast.warning("Não consegui copiar. O link apareceu na linha para você copiar à mão.")
      }
    })
  }

  function enviarPorEmail() {
    startTransition(async () => {
      const r = await sendGuideByEmailAction(guide.id)
      if (r.error) toast.error(r.error)
      else toast.success(r.message ?? "Guia enviada.")
    })
  }

  const actions: RowAction[] = [
    {
      key: "abrir",
      label: "Abrir em nova aba",
      icon: ExternalLink,
      onSelect: abrir,
      disabled: semAnexo || isPending,
    },
    {
      key: "baixar",
      label: "Baixar",
      icon: Download,
      onSelect: baixar,
      disabled: semAnexo || isPending,
    },
    {
      key: "link",
      label: "Copiar link de 24 horas",
      icon: Link2,
      onSelect: copiarLink,
      disabled: semAnexo || isPending,
    },
    {
      key: "email",
      label: "Enviar por e-mail ao paciente",
      icon: Mail,
      onSelect: enviarPorEmail,
      disabled: semAnexo || isPending,
    },
    ...(canManage
      ? [
          {
            key: "excluir",
            label: "Excluir guia",
            icon: Trash2,
            danger: true,
            render: (control) => <ExcluirGuiaDialog guide={guide} {...control} />,
          } satisfies RowAction,
        ]
      : []),
  ]

  return (
    <div className="grid justify-end gap-1">
      <RowActions actions={actions} label={`Ações da guia ${guide.guideNumber ?? ""}`} />
      {linkDeReserva && (
        <a
          href={linkDeReserva}
          target="_blank"
          rel="noopener noreferrer"
          className="max-w-40 truncate text-[0.7rem] underline underline-offset-2"
        >
          abrir a guia
        </a>
      )}
    </div>
  )
}

function ExcluirGuiaDialog({
  guide,
  open,
  onOpenChange,
}: {
  guide: GuideRow
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [isPending, startTransition] = useTransition()

  function excluir() {
    startTransition(async () => {
      const r = await cancelGuideAction(guide.id)
      if (r.error) {
        toast.error(r.error)
        return
      }
      toast.success(r.message ?? "Guia excluída.")
      onOpenChange(false)
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir a guia {guide.guideNumber ?? ""}?</AlertDialogTitle>
          <AlertDialogDescription>
            Ela sai das listas e o atendimento de {guide.patientName} fica livre para receber
            outra guia. A guia deixa de contar no limite mensal do convênio.
            {guide.attachmentKey && " O arquivo anexado é apagado definitivamente."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Manter</AlertDialogCancel>
          {/* AlertDialogAction é botão comum, não Close: fechar é responsabilidade da ação,
              depois do sucesso. Fechar antes mostraria a linha ainda na lista. */}
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              excluir()
            }}
            disabled={isPending}
          >
            {isPending ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
