"use server"

import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { recordAudit } from "@/services/audit.service"
import { getGuide } from "@/services/billing.service"
import {
  DEFAULT_LINK_TTL_SECONDS,
  guideAttachmentUrl,
  isR2Configured,
} from "@/lib/storage/guide-attachments"

export type AttachmentLinkState = { url?: string; error?: string }

/**
 * Devolve um link temporário para ver ou baixar o anexo de uma guia.
 *
 * O link é gerado SOB DEMANDA e nunca renderizado junto com a lista. São duas razões:
 *
 *  - Um link assinado é uma credencial de curta duração. Colocá-lo no HTML de uma tabela
 *    entrega, de uma vez, um acesso válido a cada guia listada — inclusive para quem só
 *    passou o olho na tela. Aqui ele nasce quando alguém clica, e o clique fica registrado.
 *  - A assinatura tem custo e validade. Assinar dezenas de anexos que ninguém vai abrir
 *    encurta a vida útil de todos eles a partir do carregamento da página.
 *
 * A leitura é auditada porque a guia liga paciente, atendimento e convênio — é dado de
 * saúde, e "quem olhou o quê" é a pergunta que uma clínica precisa saber responder.
 */
export async function guideAttachmentLinkAction(guideId: string): Promise<AttachmentLinkState> {
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

  const url = await guideAttachmentUrl(guia.attachment_url, DEFAULT_LINK_TTL_SECONDS)
  if (!url) return { error: "Não foi possível gerar o link agora. Tente de novo." }

  await recordAudit({
    clinicId: membership.clinicId,
    userId: membership.userId,
    action: "billing.guide.attachment.view",
    entityType: "service_guide",
    entityId: guia.id,
    // Nunca o link em si: ele É a credencial, e a trilha de auditoria é lida por mais gente
    // do que o anexo. Guardar horas de validade responde "por quanto tempo aquele acesso
    // valeu" sem entregar o acesso a quem lê a trilha.
    after: { guideNumber: guia.guide_number, ttlHours: DEFAULT_LINK_TTL_SECONDS / 3600 },
  })

  return { url }
}
