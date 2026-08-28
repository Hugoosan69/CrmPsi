"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/config/permissions"
import { campaignSchema, automationSchema } from "@/schemas/campaign.schema"
import {
  createCampaign,
  listCampaignRecipients,
  queueMessage,
  resolveMessageVariables,
  saveAutomation,
  sendMessage,
  setCampaignStatus,
} from "@/services/communication.service"
import { renderWithMissing } from "@/config/message-variables"
import { recordAudit } from "@/services/audit.service"
import { describeDbError } from "@/lib/db-errors"
import type { MessageChannel, MessageType } from "@/types/supabase"

export type CampaignActionState = { error?: string; success?: string }

function revalidateComms() {
  revalidatePath("/gestao/comunicacao")
}

export async function createCampaignAction(
  _prev: CampaignActionState,
  formData: FormData
): Promise<CampaignActionState> {
  const membership = await requirePermission(PERMISSIONS.SETTINGS_MANAGE)

  const parsed = campaignSchema.safeParse({
    name: formData.get("name"),
    channel: formData.get("channel"),
    subject: formData.get("subject") ?? "",
    body_template: formData.get("body_template"),
    audience: formData.get("audience"),
    patient_id: formData.get("patient_id") ?? "",
    scheduled_for: formData.get("scheduled_for") ?? "",
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  try {
    const supabase = await createClient()
    const id = await createCampaign(supabase, membership.clinicId, membership.userId, parsed.data)

    await recordAudit({
      clinicId: membership.clinicId,
      userId: membership.userId,
      action: "campaign.create",
      entityType: "message_campaign",
      entityId: id,
      after: { name: parsed.data.name, audience: parsed.data.audience },
    })
  } catch (err) {
    console.error("createCampaignAction failed", err)
    return { error: describeDbError(err) }
  }

  revalidateComms()
  return {
    success: parsed.data.scheduled_for
      ? "Campanha agendada."
      : "Rascunho salvo. Revise e dispare quando quiser.",
  }
}

/**
 * Dispara a campanha agora.
 *
 * Uma linha em `messages` por destinatário, com o corpo já renderizado — guardar o texto
 * final e não o modelo é o que permite auditar meses depois exatamente o que a pessoa
 * recebeu, mesmo que o modelo tenha mudado desde então.
 *
 * Falhas individuais não abortam o lote: um paciente sem telefone não pode impedir os
 * outros 200 de receberem. A contagem separada de enviados e falhos é o que conta essa
 * história na tela.
 */
export async function dispatchCampaignAction(campaignId: string): Promise<CampaignActionState> {
  const membership = await requirePermission(PERMISSIONS.SETTINGS_MANAGE)
  const supabase = await createClient()

  try {
    const { data: campaign, error } = await supabase
      .from("message_campaigns")
      .select("id, name, channel, subject, body_template, status, scheduled_for")
      .eq("id", campaignId)
      .eq("clinic_id", membership.clinicId)
      .maybeSingle()
    if (error) throw error
    if (!campaign) return { error: "Campanha não encontrada nesta clínica." }
    if (campaign.status === "sending" || campaign.status === "sent") {
      return { error: "Esta campanha já foi disparada." }
    }

    const recipients = await listCampaignRecipients(supabase, campaignId)
    if (recipients.length === 0) {
      return { error: "Nenhum paciente corresponde ao público selecionado." }
    }

    await setCampaignStatus(supabase, membership.clinicId, campaignId, "sending", {
      recipients_count: recipients.length,
    })

    let sent = 0
    let failed = 0
    let skipped = 0
    for (const person of recipients) {
      // Valores reais do banco, não só o que veio na lista de destinatários: data, hora,
      // profissional e procedimento saem da próxima consulta da pessoa, e sem isso um
      // lembrete montado com {{data}} sairia com a frase truncada.
      const values = await resolveMessageVariables(
        supabase,
        membership.clinicId,
        person.patient_id,
        membership.clinicName
      )
      const { body, missing } = renderWithMissing(campaign.body_template, values)

      // Pula em vez de enviar frase quebrada. A pré-visualização usa dados de exemplo e por
      // isso mostra sempre a frase completa; para quem não tem consulta futura, {{data}},
      // {{hora}} e {{profissional}} resolvem vazio e o texto vira "marcada para  às  com ."
      // Mandar isso ao paciente é pior do que não mandar — e some sem deixar rastro se o
      // motivo não for gravado.
      if (missing.length > 0) {
        await queueMessage(supabase, membership.clinicId, {
          patientId: person.patient_id,
          campaignId: campaign.id,
          templateId: null,
          channel: campaign.channel as MessageChannel,
          type: "general" as MessageType,
          subject: campaign.subject,
          body,
          scheduledAt: campaign.scheduled_for,
          status: "skipped",
          reason: { skipped: "variaveis_sem_valor", missing },
        })
        skipped += 1
        continue
      }

      try {
        if (campaign.scheduled_for) {
          // Agendada: enfileira para o n8n buscar na varredura, em vez de disparar agora.
          // Enviar no clique anularia o agendamento que o operador configurou.
          await queueMessage(supabase, membership.clinicId, {
            patientId: person.patient_id,
            campaignId: campaign.id,
            templateId: null,
            channel: campaign.channel as MessageChannel,
            type: "general" as MessageType,
            subject: campaign.subject,
            body,
            scheduledAt: campaign.scheduled_for,
          })
          sent += 1
        } else {
          const result = await sendMessage(supabase, membership.clinicId, {
            patientId: person.patient_id,
            templateId: null,
            channel: campaign.channel as MessageChannel,
            type: "general" as MessageType,
            subject: campaign.subject,
            body,
          })
          if (result?.status === "sent") sent += 1
          else failed += 1
        }
      } catch (err) {
        console.error("campanha: envio falhou para", person.patient_id, err)
        failed += 1
      }
    }

    await setCampaignStatus(supabase, membership.clinicId, campaignId, "sent", {
      sent_count: sent,
      // Pulados contam como falha na tela: são pessoas que a campanha pretendia alcançar e
      // não alcançou. Esconder isso no total de enviados mentiria sobre o alcance.
      failed_count: failed + skipped,
    })

    await recordAudit({
      clinicId: membership.clinicId,
      userId: membership.userId,
      action: "campaign.dispatch",
      entityType: "message_campaign",
      entityId: campaignId,
      after: { recipients: recipients.length, sent, failed, skipped },
    })

    revalidateComms()
    return {
      success:
        campaign.scheduled_for
          ? `${sent} mensagem(ns) na fila para ${new Date(campaign.scheduled_for).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`
          : skipped > 0
            ? `Enviada para ${sent}. ${skipped} paciente(s) pulado(s) por não ter dados para todas as variáveis usadas — a mensagem sairia com lacunas.`
            : failed === 0
              ? `Campanha enviada para ${sent} paciente(s).`
              : `Enviada para ${sent}, com ${failed} falha(s). Veja o histórico de cada paciente.`,
    }
  } catch (err) {
    console.error("dispatchCampaignAction failed", err)
    // Deixar "sending" travaria a campanha para sempre; volta a falha para poder reeditar.
    await setCampaignStatus(supabase, membership.clinicId, campaignId, "failed").catch(() => {})
    return { error: describeDbError(err) }
  }
}

export async function cancelCampaignAction(campaignId: string): Promise<CampaignActionState> {
  const membership = await requirePermission(PERMISSIONS.SETTINGS_MANAGE)
  const supabase = await createClient()

  try {
    await setCampaignStatus(supabase, membership.clinicId, campaignId, "cancelled")
  } catch (err) {
    return { error: describeDbError(err) }
  }

  revalidateComms()
  return { success: "Campanha cancelada." }
}

export async function saveAutomationAction(
  _prev: CampaignActionState,
  formData: FormData
): Promise<CampaignActionState> {
  const membership = await requirePermission(PERMISSIONS.SETTINGS_MANAGE)

  const parsed = automationSchema.safeParse({
    type: formData.get("type"),
    enabled: formData.get("enabled") === "on",
    channel: formData.get("channel"),
    template_id: formData.get("template_id") ?? "",
    offset_minutes: formData.get("offset_minutes"),
    send_at_time: formData.get("send_at_time") ?? "",
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  try {
    const supabase = await createClient()
    await saveAutomation(supabase, membership.clinicId, parsed.data)

    await recordAudit({
      clinicId: membership.clinicId,
      userId: membership.userId,
      action: "automation.save",
      entityType: "message_automation",
      entityId: parsed.data.type,
      after: parsed.data,
    })
  } catch (err) {
    console.error("saveAutomationAction failed", err)
    return { error: describeDbError(err) }
  }

  revalidateComms()
  return { success: "Automação salva." }
}
