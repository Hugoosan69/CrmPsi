import "server-only"

import { AwsClient } from "aws4fetch"

/**
 * Cliente do bucket R2 da Cloudflare.
 *
 * `aws4fetch` e não `@aws-sdk/client-s3`: o R2 fala o protocolo S3, e o que se precisa daqui
 * é assinar quatro requisições. O SDK oficial traria uma árvore de dependências inteira
 * para isso — e este projeto já tem um precedente do mesmo raciocínio, na assinatura do
 * webhook do Stripe, escrita à mão em vez de arrastar o SDK.
 *
 * As credenciais são de nível de deploy, como as do Supabase e do Stripe: quem tem a chave
 * do bucket lê a guia de qualquer paciente da clínica. Nunca `NEXT_PUBLIC_`.
 */

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const BUCKET = process.env.R2_BUCKET ?? "crm"

/** Presença, nunca valores — pode ser exposto pelo /api/health. */
export function r2EnvStatus() {
  return {
    accountId: Boolean(ACCOUNT_ID),
    accessKeyId: Boolean(ACCESS_KEY_ID),
    secretAccessKey: Boolean(SECRET_ACCESS_KEY),
    bucket: BUCKET,
  }
}

export function isR2Configured() {
  return Boolean(ACCOUNT_ID && ACCESS_KEY_ID && SECRET_ACCESS_KEY)
}

function endpoint() {
  if (!ACCOUNT_ID) throw new Error("Missing R2_ACCOUNT_ID.")
  return `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`
}

function client() {
  if (!ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    throw new Error("Missing R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY.")
  }
  return new AwsClient({
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
    service: "s3",
    // O R2 ignora a região, mas a assinatura SigV4 exige uma — `auto` é a que a Cloudflare
    // documenta para clientes S3.
    region: "auto",
  })
}

function objectUrl(key: string) {
  return `${endpoint()}/${BUCKET}/${encodeURI(key)}`
}

export async function r2Put(key: string, body: ArrayBuffer | Blob, contentType: string) {
  const res = await client().fetch(objectUrl(key), {
    method: "PUT",
    body,
    headers: { "Content-Type": contentType },
  })
  if (!res.ok) {
    throw new Error(`R2 PUT falhou (${res.status}): ${await res.text().catch(() => "")}`)
  }
}

export async function r2Get(key: string): Promise<Blob | null> {
  const res = await client().fetch(objectUrl(key))
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`R2 GET falhou (${res.status})`)
  return res.blob()
}

export async function r2Delete(key: string) {
  const res = await client().fetch(objectUrl(key), { method: "DELETE" })
  // 404 é o estado desejado: o objeto já não está lá.
  if (!res.ok && res.status !== 404) throw new Error(`R2 DELETE falhou (${res.status})`)
}

/**
 * Endereço temporário para ver o arquivo, assinado no servidor.
 *
 * O bucket não é público — e não deve ser: a guia liga paciente, atendimento e convênio, e
 * um endereço permanente vaza para sempre a quem o receber uma vez. Um link assinado morre
 * sozinho, e é isso que torna seguro mandá-lo por e-mail ou WhatsApp.
 *
 * `X-Amz-Expires` é o teto do protocolo: 7 dias. O padrão daqui são 24 horas, que é o que
 * a clínica pediu.
 */
export async function r2SignedUrl(key: string, expiresInSeconds = 60 * 60 * 24) {
  const url = new URL(objectUrl(key))
  url.searchParams.set("X-Amz-Expires", String(Math.min(expiresInSeconds, 60 * 60 * 24 * 7)))

  const signed = await client().sign(new Request(url, { method: "GET" }), {
    aws: { signQuery: true },
  })
  return signed.url
}
