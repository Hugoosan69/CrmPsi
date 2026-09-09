"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

/**
 * Fecha o aviso ao clicar em qualquer lugar dele.
 *
 * O sonner só oferece duas saídas: esperar o tempo acabar, ou arrastar para o lado. Nenhuma
 * das duas é o que alguém faz por instinto — a pessoa clica no aviso e espera que ele suma,
 * e enquanto ele não some fica por cima dos botões da tela.
 *
 * A saída é delegar no documento e acionar o PRÓPRIO botão de fechar do aviso clicado. Isso
 * evita ter de descobrir o id do toast (o sonner não o expõe no DOM) e faz o fechamento
 * passar pelo mesmo caminho de sempre, com animação e `onDismiss` inclusos. Com vários
 * avisos empilhados, some só o que foi clicado.
 *
 * Clique em botão de ação dentro do aviso não fecha nada aqui: quem trata é o próprio botão,
 * e roubar esse clique cancelaria a ação que a pessoa quis executar.
 */
function useDismissOnClick() {
  useEffect(() => {
    function aoClicar(evento: MouseEvent) {
      const alvo = evento.target
      if (!(alvo instanceof Element)) return

      const aviso = alvo.closest("[data-sonner-toast]")
      if (!aviso) return
      if (alvo.closest("[data-button]") || alvo.closest("[data-close-button]")) return

      const fechar = aviso.querySelector<HTMLElement>("[data-close-button]")
      fechar?.click()
    }

    document.addEventListener("click", aoClicar)
    return () => document.removeEventListener("click", aoClicar)
  }, [])
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  useDismissOnClick()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // O X é o que torna o fechamento descobrível e alcançável pelo teclado — o clique no
      // corpo do aviso é o atalho, não a única porta.
      closeButton
      toastOptions={{
        closeButtonAriaLabel: "Fechar aviso",
        classNames: {
          toast: "cn-toast cursor-pointer",
        },
      }}
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
