import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Onde a guia anexada é guardada.
 *
 * Existe como módulo próprio porque o destino ainda vai mudar: hoje é o storage do
 * Supabase, e a clínica decidiu que passará a ser um bucket R2 da Cloudflare ("crm").
 * Isolando aqui, a troca é reescrever ESTE arquivo — a action que emite a guia, a tela que
 * anexa e a ficha do paciente não sabem (nem devem saber) onde o arquivo mora.
 *
 * `service_guides` já guarda as duas formas de referência (`file_id` e `attachment_url`),
 * então o que já foi anexado continua acessível depois da troca.
 */

const BUCKET = "guides"
/** 8 MB: a foto de uma guia pelo celular cabe folgada, e um PDF de página única também. */
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024
export const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"]

export type AttachmentRef = {
  /** Chave dentro do bucket. É o que se guarda; a URL é gerada na hora de ver. */
  key: string
}

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
 * Sobe o anexo e devolve a chave.
 *
 * O caminho começa pelo `clinicId` porque é o que as policies do bucket conferem — uma
 * clínica não alcança a guia de outra nem sabendo o nome do arquivo. Mantenha essa forma
 * ao trocar para o R2: o isolamento entre clínicas não pode depender de o nome ser difícil
 * de adivinhar.
 */
export async function uploadGuideAttachment(
  clinicId: string,
  appointmentId: string,
  file: File
): Promise<AttachmentRef> {
  const key = `${clinicId}/${appointmentId}-${Date.now()}`
  const admin = createAdminClient()

  const { error } = await admin.storage
    .from(BUCKET)
    .upload(key, file, { contentType: file.type, upsert: false })
  if (error) throw error

  return { key }
}

/**
 * Um endereço temporário para ver o anexo.
 *
 * Sempre temporário, nunca público: a guia liga paciente, atendimento e convênio — é dado
 * de saúde, e um link permanente vaza para sempre a quem o receber uma vez.
 */
export async function guideAttachmentUrl(
  key: string,
  expiresInSeconds = 60 * 60 * 24
): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(key, expiresInSeconds)
  if (error) {
    console.error("falha ao gerar link do anexo da guia", error)
    return null
  }
  return data?.signedUrl ?? null
}

/** Baixa o conteúdo — para anexar num e-mail sem passar pelo navegador de quem envia. */
export async function downloadGuideAttachment(key: string): Promise<Blob | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(BUCKET).download(key)
  if (error) {
    console.error("falha ao baixar o anexo da guia", error)
    return null
  }
  return data
}
