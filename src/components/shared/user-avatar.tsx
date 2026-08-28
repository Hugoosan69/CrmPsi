"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  // Nome único usa as duas primeiras letras. Uma letra só numa bola de 32px parece erro de
  // renderização, e há gente cadastrada apenas pelo primeiro nome.
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Foto do usuário com as iniciais como reserva.
 *
 * A reserva não é decorativa: o endereço da foto fica gravado em `profiles.avatar_url` e
 * segue sendo devolvido mesmo se o arquivo sumir do bucket ou a rede falhar. Sem o
 * `onError` a barra lateral mostraria o ícone de imagem quebrada no lugar de quem está
 * logado — por isso a falha volta para as iniciais em vez de insistir.
 *
 * O estado guarda QUAL endereço falhou, não um booleano. O componente sobrevive à troca de
 * foto, e um booleano deixaria a foto nova presa nas iniciais por causa da anterior — sem
 * precisar de um efeito só para zerar a marca.
 *
 * Sem next/image de propósito. O arquivo vem do Storage do Supabase, um host que precisaria
 * ser liberado na configuração, e o ganho de otimizar uma imagem de 32px não paga o
 * acoplamento.
 */
export function UserAvatar({
  src,
  name,
  className,
  textClassName,
}: {
  src: string | null | undefined
  name: string
  className?: string
  textClassName?: string
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const broken = Boolean(src) && src === failedSrc

  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary font-semibold text-secondary-foreground",
        className
      )}
    >
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          className="size-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <span className={cn("text-[0.7rem]", textClassName)} aria-hidden>
          {initialsOf(name)}
        </span>
      )}
    </span>
  )
}
