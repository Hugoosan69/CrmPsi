"use client"

import { useActionState, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/shared/user-avatar"
import { updateAvatarAction, type ProfileActionState } from "../actions/profile.actions"
import { MAX_AVATAR_BYTES, formatMegabytes } from "@/config/uploads"

const initialState: ProfileActionState = {}

/**
 * Foto do perfil.
 *
 * O envio dispara na escolha do arquivo, sem um "salvar" separado. Trocar a foto é uma
 * decisão só — e uma foto escolhida mas não salva é a forma mais provável de a pessoa sair
 * daqui achando que trocou.
 *
 * A prévia local (URL.createObjectURL) cobre a ida ao servidor: o arquivo pode ter alguns
 * megabytes, e sem ela o avatar antigo continuaria à vista durante o upload inteiro, como
 * se nada tivesse acontecido.
 */
export function AvatarField({
  fullName,
  avatarUrl,
}: {
  fullName: string
  avatarUrl: string | null
}) {
  const [state, formAction, isPending] = useActionState(updateAvatarAction, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  const removeRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  // A prévia vence enquanto existe; depois vale o que voltou do servidor.
  const shown = preview ?? avatarUrl

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    // Conferido aqui e de novo no servidor. Aqui porque o Next corta o corpo da requisição
    // acima do teto configurado e devolve um 500 do framework, sem passar pela action — ou
    // seja, sem a mensagem que explica o que houve. E porque não faz sentido subir dez
    // megabytes para ouvir um "não" que já dava para dar na hora.
    if (file.size > MAX_AVATAR_BYTES) {
      setLocalError(
        `Imagem muito grande (${formatMegabytes(file.size)}). O limite é ${formatMegabytes(MAX_AVATAR_BYTES)}.`
      )
      event.target.value = ""
      return
    }
    setLocalError(null)

    setPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous)
      return URL.createObjectURL(file)
    })
    if (removeRef.current) removeRef.current.value = "false"
    formRef.current?.requestSubmit()
  }

  function onRemove() {
    setLocalError(null)
    setPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous)
      return null
    })
    if (removeRef.current) removeRef.current.value = "true"
    formRef.current?.requestSubmit()
  }

  return (
    <form ref={formRef} action={formAction} className="grid gap-3 border-b border-border pb-4">
      <input ref={removeRef} type="hidden" name="remove" defaultValue="false" />

      <div className="flex items-center gap-4">
        <UserAvatar
          src={shown}
          name={fullName}
          className="size-16"
          textClassName="text-base"
        />

        <div className="grid gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* O input fica escondido atrás do label: o controle nativo de arquivo não
                aceita estilo e destoaria de todos os outros botões da tela.
                `nativeButton={false}` porque o elemento renderizado é um <label>, não um
                <button> — sem isso o Base UI reclama de perder a semântica nativa, e é ele
                quem passa a cuidar de role e teclado. */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              nativeButton={false}
              disabled={isPending}
              render={<label htmlFor="avatar-file" />}
            >
              {isPending ? "Enviando..." : shown ? "Trocar foto" : "Enviar foto"}
            </Button>
            <input
              id="avatar-file"
              name="avatar_file"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={onPick}
              disabled={isPending}
            />

            {shown && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRemove}
                disabled={isPending}
              >
                Remover
              </Button>
            )}
          </div>
          <p className="text-[0.75rem] text-muted-foreground">
            PNG, JPEG ou WebP, até {formatMegabytes(MAX_AVATAR_BYTES)}. Aparece na barra
            lateral e no menu da conta.
          </p>
        </div>
      </div>

      {(localError ?? state.error) && (
        <p className="text-sm text-destructive" role="alert">
          {localError ?? state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-status-success" role="status">
          {state.success}
        </p>
      )}
    </form>
  )
}
