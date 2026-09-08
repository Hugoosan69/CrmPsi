import "server-only"

import { isR2Configured, r2Delete, r2Get, r2Put, r2SignedUrl } from "./r2"

/**
 * Onde a guia anexada é guardada.
 *
 * O destino é o bucket R2 da Cloudflare. Este módulo existe para ser a única parte do
 * sistema que sabe disso: a action que emite a guia, a tela que anexa e a ficha do paciente
 * falam só com estas funções. Se o destino mudar de novo, muda aqui.
 *
 * O bucket NÃO é público, e não deve ser. A guia liga paciente, atendimento e convênio — é
 * dado de saúde. Ver o arquivo é sempre por link assinado, que expira; nunca por um
 * endereço fixo que, uma vez vazado, vale para sempre.
 */

/** 8 MB: a foto de uma guia pelo celular cabe folgada, e um PDF de página única também. */
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024
export const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"]
/** O que a clínica pediu: um link que vive um dia. */
export const DEFAULT_LINK_TTL_SECONDS = 60 * 60 * 24

export { isR2Configured }

export function validateAttachment(file: File): string | null {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return "O anexo passa de 8 MB. Envie uma imagem menor ou um PDF."
  }
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "Anexe um PDF ou uma imagem (JPEG, PNG ou WebP)."
  }
  return null
}

/**
 * A chave de um anexo dentro do bucket.
 *
 * Começa pelo `clinicId` por dois motivos: separa as clínicas em prefixos distintos (o que
 * permite política e auditoria por prefixo) e torna óbvio, olhando a chave, a quem o
 * arquivo pertence. O restante identifica o atendimento e o instante — nunca o nome do
 * paciente, que não deve aparecer num caminho de arquivo.
 */
function buildKey(clinicId: string, appointmentId: string, fileName: string) {
  const extensao = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "bin"
  return `guias/${clinicId}/${appointmentId}/${Date.now()}.${extensao}`
}

export async function uploadGuideAttachment(
  clinicId: string,
  appointmentId: string,
  file: File
): Promise<{ key: string }> {
  const key = buildKey(clinicId, appointmentId, file.name)
  await r2Put(key, await file.arrayBuffer(), file.type)
  return { key }
}

/**
 * Link temporário para ver ou baixar o anexo.
 *
 * É o que a ficha do paciente usa para "ver a guia" e o que se manda por e-mail. Devolve
 * `null` quando não há como gerar — a tela mostra o motivo em vez de um link quebrado.
 */
export async function guideAttachmentUrl(
  key: string,
  expiresInSeconds = DEFAULT_LINK_TTL_SECONDS,
  opts: { downloadAs?: string } = {}
): Promise<string | null> {
  if (!isR2Configured()) return null
  try {
    return await r2SignedUrl(key, expiresInSeconds, opts)
  } catch (err) {
    console.error("falha ao gerar link do anexo da guia", err)
    return null
  }
}

/**
 * O nome com que o arquivo chega ao computador de quem baixa.
 *
 * No bucket o objeto se chama por timestamp — bom para não colidir, péssimo numa pasta de
 * downloads. Aqui ele ganha o número da guia, preservando a extensão original, que é o que
 * decide se o sistema operacional abre no leitor de PDF ou no visualizador de imagens.
 */
export function guideDownloadName(key: string, guideNumber: string | null): string {
  const extensao = key.includes(".") ? key.split(".").pop()!.toLowerCase() : "pdf"
  // Só o que sobrevive a qualquer sistema de arquivos: número de guia costuma vir com
  // barras e pontos do papel do convênio.
  const seguro = (guideNumber ?? "sem-numero").replace(/[^\w.-]+/g, "-")
  return `guia-${seguro}.${extensao}`
}

/** Baixa o conteúdo — para anexar num e-mail sem passar pelo navegador de quem envia. */
export async function downloadGuideAttachment(key: string): Promise<Blob | null> {
  if (!isR2Configured()) return null
  try {
    return await r2Get(key)
  } catch (err) {
    console.error("falha ao baixar o anexo da guia", err)
    return null
  }
}

export async function deleteGuideAttachment(key: string): Promise<void> {
  if (!isR2Configured()) return
  await r2Delete(key)
}
