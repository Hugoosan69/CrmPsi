"use server"

import { revalidatePath } from "next/cache"

import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { describeDbError } from "@/lib/db-errors"
import { recordAudit } from "@/services/audit.service"
import { cancelServiceGuide, getGuide, listGuides } from "@/services/billing.service"
import { sendMessage } from "@/services/communication.service"
import {
  DEFAULT_LINK_TTL_SECONDS,
  deleteGuideAttachment,
  guideAttachmentUrl,
  guideDownloadName,
  isR2Configured,
} from "@/lib/storage/guide-attachments"
import {
  guideEmailHtml,
  guideEmailSubject,
  guideEmailText,
} from "../guide-email"

export type AttachmentLinkState = { url?: string; error?: string }
export type GuideActionResult = { ok?: true; message?: string; error?: string }

const TTL_HORAS = DEFAULT_LINK_TTL_SECONDS / 3600

/**
 * Um link temporário para o anexo de uma guia.
 *
 * O link é gerado SOB DEMANDA e nunca renderizado junto com a lista. São duas razões:
 *
 *  - Um link assinado é uma credencial de curta duração. Colocá-lo no HTML de uma tabela
 *    entrega, de uma vez, um acesso válido a cada guia listada — inclusive para quem só
 *    passou o olho na tela. Aqui ele nasce quando alguém clica, e o clique fica registrado.
 *  - A assinatura tem validade. Assinar dezenas de anexos que ninguém vai abrir encurta a
 *    vida útil de todos eles a partir do carregamento da página.
 *
 * `mode` decide entre ver e baixar, e são links DIFERENTES: baixar exige
 * `response-content-disposition`, que entra na assinatura. Um link só não faria as duas.
 *
 * A leitura é auditada porque a guia liga paciente, atendimento e convênio — é dado de
 * saúde, e "quem olhou o quê" é a pergunta que uma clínica precisa saber responder.
 */
export async function guideAttachmentLinkAction(
  guideId: string,
  mode: "view" | "download" | "share" = "view"
): Promise<AttachmentLinkState> {
  const membership = await requirePermission(PERMISSIONS.BILLING_VIEW)

  if (!isR2Configured()) {
    return { error: "O armazenamento de anexos não está configurado neste ambiente." }
  }

  const supabase = await createClient()
  // Lê pelo id COM o clinic_id: sem isso, um id de outra clínica devolveria um link válido
  // para um documento que não é desta — a RLS já barraria, mas a checagem aqui é o que
  // transforma isso numa mensagem em vez de um erro de banco.
  const guia = await getGuide(supabase, membership.clinicId, guideId)
  if (!guia) return { error: "Guia não encontrada." }
  if (!guia.attachment_url) return { error: "Esta guia não tem anexo." }

  const url = await guideAttachmentUrl(guia.attachment_url, DEFAULT_LINK_TTL_SECONDS, {
    downloadAs:
      mode === "download"
        ? guideDownloadName(guia.attachment_url, guia.guide_number)
        : undefined,
  })
  if (!url) return { error: "Não foi possível gerar o link agora. Tente de novo." }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: `billing.guide.attachment.${mode}`,
    entityType: "service_guide",
    entityId: guia.id,
    // Nunca o link em si: ele É a credencial, e a trilha de auditoria é lida por mais gente
    // do que o anexo. Guardar horas de validade responde "por quanto tempo aquele acesso
    // valeu" sem entregar o acesso a quem lê a trilha.
    after: { guideNumber: guia.guide_number, ttlHours: TTL_HORAS },
  })

  return { url }
}

/**
 * Manda a guia ao paciente por e-mail, com um link de 24 horas.
 *
 * O LINK, e não o arquivo em anexo. Anexo de e-mail viaja para sempre: fica na caixa de
 * quem recebeu, nos servidores por onde passou e em qualquer encaminhamento — e isto é um
 * documento que liga paciente, atendimento e convênio. O link morre sozinho, e é essa
 * validade que torna o envio defensável.
 *
 * Sai pelo mesmo `sendMessage` de todo o resto: a mensagem fica registrada em `messages`,
 * o provedor é o que a clínica configurou, e paciente sem e-mail no cadastro devolve
 * `skipped` em vez de estourar.
 */
export async function sendGuideByEmailAction(guideId: string): Promise<GuideActionResult> {
  const membership = await requirePermission(PERMISSIONS.BILLING_VIEW)
  const supabase = await createClient()

  try {
    const guia = await getGuide(supabase, membership.clinicId, guideId)
    if (!guia) return { error: "Guia não encontrada." }
    if (!guia.attachment_url) {
      return { error: "Esta guia não tem anexo para enviar." }
    }

    // A listagem já resolve paciente, convênio e data pelos nomes de agora — reusá-la evita
    // uma segunda versão da mesma junção, que divergiria no primeiro ajuste.
    const [linha] = await listGuides(supabase, membership.clinicId, { id: guideId })
    if (!linha) return { error: "Guia não encontrada." }
    if (!linha.patientId) {
      return { error: "Este atendimento não tem paciente vinculado." }
    }

    const link = await guideAttachmentUrl(guia.attachment_url, DEFAULT_LINK_TTL_SECONDS)
    if (!link) return { error: "Não foi possível gerar o link do anexo." }

    const dados = {
      clinicName: membership.clinicName,
      patientName: linha.patientName,
      guideNumber: linha.guideNumber,
      insurerName: linha.insurerName,
      appointmentDate: linha.scheduledAt
        ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(
            new Date(linha.scheduledAt)
          )
        : null,
      link,
      expiresInHours: TTL_HORAS,
    }

    const resultado = await sendMessage(supabase, membership.clinicId, {
      patientId: linha.patientId,
      templateId: null,
      channel: "email",
      type: "general",
      subject: guideEmailSubject(dados),
      // HTML no corpo, texto puro no fim: o provedor decide o que usar, e um cliente que
      // não renderize HTML ainda encontra a informação legível.
      body: `${guideEmailHtml(dados)}\n\n<!-- texto puro -->\n${guideEmailText(dados)}`,
    })

    await recordAudit({
      clinicId: membership.clinicId,
      userId: membership.userId,
      action: "billing.guide.email",
      entityType: "service_guide",
      entityId: guia.id,
      after: {
        guideNumber: guia.guide_number,
        patient: linha.patientName,
        status: resultado.status,
        ttlHours: TTL_HORAS,
      },
    })

    if (resultado.status === "skipped") {
      return { error: "O paciente não tem e-mail no cadastro. Preencha na ficha e tente de novo." }
    }
    if (resultado.status === "failed") {
      return { error: "O provedor recusou o envio. Veja em Gestão › Comunicação o que voltou." }
    }
    return { ok: true, message: `Guia enviada para ${linha.patientName}. O link vale ${TTL_HORAS} horas.` }
  } catch (err) {
    return { error: describeDbError(err) }
  }
}

/**
 * Exclui a guia.
 *
 * Do ponto de vista de quem usa, ela some: sai das duas listas, sai do detalhe do
 * lançamento, e o atendimento fica livre para receber outra. Por dentro é um cancelamento
 * — `status = 'cancelada'` —, e não um DELETE, por três razões concretas:
 *
 *  1. A guia é documento de faturamento. Se já entrou num protocolo enviado ao convênio,
 *     apagar a linha deixaria o protocolo apontando para o nada, e ninguém saberia explicar
 *     a diferença quando o convênio pagasse a menos.
 *  2. O índice único de "uma guia viva por atendimento" já exclui as canceladas, então
 *     cancelar libera o atendimento exatamente como um DELETE liberaria.
 *  3. A contagem do limite mensal também ignora canceladas — emitir por engano e desfazer
 *     não gasta a guia do paciente.
 *
 * O ANEXO, esse é apagado de verdade do bucket. Ele não é registro contábil, é uma cópia
 * de um papel; mantê-lo guardaria dado de saúde de algo que a clínica decidiu descartar.
 * Exige `billing.manage`: emitir é rotina de balcão, desfazer não.
 */
export async function cancelGuideAction(guideId: string): Promise<GuideActionResult> {
  const membership = await requirePermission(PERMISSIONS.BILLING_MANAGE)
  const supabase = await createClient()

  try {
    const guia = await getGuide(supabase, membership.clinicId, guideId)
    if (!guia) return { error: "Guia não encontrada." }
    if (guia.status === "cancelada") return { error: "Esta guia já está cancelada." }
    if (guia.batch_id) {
      return {
        error:
          "Esta guia já está num protocolo enviado ao convênio. Cancele o protocolo antes de excluí-la.",
      }
    }

    await cancelServiceGuide(supabase, membership.clinicId, guideId)

    // Depois da marcação, nunca antes: falhar aqui deixa um objeto órfão no bucket, que é
    // barato de limpar. Falhar na ordem inversa deixaria uma guia viva apontando para um
    // arquivo que não existe mais.
    if (guia.attachment_url) {
      try {
        await deleteGuideAttachment(guia.attachment_url)
      } catch (err) {
        console.error("guia cancelada, mas o anexo continuou no bucket", err)
      }
    }

    await recordAudit({
      clinicId: membership.clinicId,
      userId: membership.userId,
      action: "billing.guide.cancel",
      entityType: "service_guide",
      entityId: guia.id,
      before: { status: guia.status, guideNumber: guia.guide_number },
      after: { status: "cancelada", attachmentRemoved: Boolean(guia.attachment_url) },
    })

    revalidatePath("/gestao/pacotes")
    revalidatePath("/recepcao/pacientes")
    return { ok: true, message: "Guia excluída." }
  } catch (err) {
    return { error: describeDbError(err) }
  }
}
