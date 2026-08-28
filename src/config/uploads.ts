/**
 * Limites de upload, num módulo neutro porque o servidor e o navegador precisam do MESMO
 * número: a Server Action recusa o arquivo grande, e a tela avisa antes de enviar. Se os
 * dois divergirem, a pessoa espera o upload inteiro para receber uma recusa.
 *
 * Não podem morar na própria action: um arquivo `"use server"` só exporta função assíncrona.
 *
 * Qualquer aumento aqui exige aumentar `experimental.serverActions.bodySizeLimit` em
 * next.config.ts junto — o Next corta o corpo antes da action rodar, e a validação daqui
 * nem chega a ser consultada.
 */

/** Foto de perfil. Foto de celular passa fácil de 2 MB. */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024

/** Logo da clínica. Menor de propósito: é um arquivo de identidade visual, preparado. */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024

export function formatMegabytes(bytes: number) {
  const mb = bytes / 1024 / 1024
  return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1)} MB`
}
