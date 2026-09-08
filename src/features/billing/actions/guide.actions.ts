"use server"

import { revalidatePath } from "next/cache"

import { requirePermission } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { PERMISSIONS } from "@/config/permissions"
import { describeDbError } from "@/lib/db-errors"
import { recordAudit } from "@/services/audit.service"
import { insurerPaymentSchema } from "@/schemas/financial.schema"
import {
  getInsurer,
  getGuideForAppointment,
  guidesUsedInMonth,
  issueServiceGuide,
  markAppointmentAsInsured,
} from "@/services/billing.service"
import {
  getTransaction,
  registerPayment,
  updateTransactionAmount,
} from "@/services/financial.service"
import { markQueueEntriesReleasedForTransaction } from "@/services/queue.service"
import {
  isR2Configured,
  uploadGuideAttachment,
  validateAttachment,
} from "@/lib/storage/guide-attachments"

export type GuideActionState = { error?: string; success?: boolean }

/**
 * Registra o atendimento como sendo de convênio, no momento do pagamento.
 *
 * É aqui que o convênio entra no sistema — não no agendamento. O motivo é prático: a guia
 * é um papel que o paciente traz na hora, e quem a recebe é quem está no balcão fechando a
 * cobrança. Pedir isso na marcação seria pedir antes de existir.
 *
 * O que acontece, nesta ordem:
 *
 *  1. O limite mensal do convênio é conferido para ESTE paciente. Estourado, para aqui.
 *  2. A guia é emitida — sem valor: quanto o convênio paga só se sabe no acerto.
 *  3. O atendimento passa a ser `convenio`, apontando QUAL.
 *  4. A cobrança do PACIENTE vai a R$ 0,00, ou fica com o valor avulso quando a recepção
 *     marcou que há cobrança por fora.
 *  5. Zerada ou paga, a cobrança satisfaz o gate e a fila libera.
 *
 * O passo 5 é o que faz isto funcionar sem tocar no trigger da migration 001: o paciente
 * não deve nada porque de fato não deve — quem deve é o convênio, e essa dívida vive na
 * guia, não na conta dele.
 *
 * O passo 1 é conferido AQUI mesmo tendo sido mostrado na tela. A tela informa; só o
 * servidor decide. Duas recepcionistas atendendo o mesmo paciente veem, cada uma, um saldo
 * calculado antes da outra gravar.
 */
export async function registerInsurerGuideAction(
  transactionId: string,
  _prev: GuideActionState,
  formData: FormData
): Promise<GuideActionState> {
  const membership = await requirePermission(PERMISSIONS.FINANCIAL_MANAGE)

  const parsed = insurerPaymentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }
  const dados = parsed.data

  if (dados.has_extra_charge) {
    if (dados.amount <= 0) {
      return { error: "Informe o valor da cobrança avulsa." }
    }
    if (!dados.payment_method_id) {
      return { error: "Selecione a forma de pagamento do valor avulso." }
    }
  }

  const supabase = await createClient()

  try {
    const charge = await getTransaction(supabase, membership.clinicId, transactionId)
    if (!charge.appointment_id) {
      return { error: "Este lançamento não está ligado a um atendimento — não dá para emitir guia." }
    }
    if (charge.status === "pago") {
      return { error: "Esta cobrança já está quitada." }
    }

    const jaTemGuia = await getGuideForAppointment(supabase, membership.clinicId, charge.appointment_id)
    if (jaTemGuia) {
      return { error: `Este atendimento já tem a guia ${jaTemGuia.guide_number ?? ""} emitida.` }
    }

    const insurer = await getInsurer(supabase, membership.clinicId, dados.insurer_id)
    if (!insurer) return { error: "Convênio não encontrado." }

    // --- limite mensal de guias ------------------------------------------
    // Bloqueia, e diz o número: "não pode" sem o porquê faz a recepção tentar de novo. Com
    // a contagem à vista, quem está no balcão já sabe que a saída é cobrar como particular.
    const limite = insurer.max_guides_per_patient_month
    if (limite !== null && charge.patient_id) {
      const referencia = new Date().toISOString().slice(0, 10)
      const usadas = await guidesUsedInMonth(
        supabase,
        membership.clinicId,
        charge.patient_id,
        insurer.id,
        referencia
      )
      if (usadas >= limite) {
        return {
          error: `Este paciente já usou ${usadas} de ${limite} guias do ${insurer.name} neste mês. Cobre como particular ou registre a guia no mês seguinte.`,
        }
      }
    }

    // --- anexo (opcional) ------------------------------------------------
    const arquivo = formData.get("attachment")
    let attachmentPath: string | null = null
    if (arquivo instanceof File && arquivo.size > 0) {
      // Sem credenciais o anexo é recusado NOMEANDO o motivo, e a guia segue sem ele: o
      // número da guia é o que o protocolo exige, o anexo é conferência. Barrar a emissão
      // inteira por falta de uma variável de ambiente seria trocar um problema por outro.
      if (!isR2Configured()) {
        return {
          error:
            "O armazenamento de anexos não está configurado neste ambiente. Emita a guia sem anexo ou configure as credenciais do R2.",
        }
      }
      const invalido = validateAttachment(arquivo)
      if (invalido) return { error: invalido }
      try {
        const { key } = await uploadGuideAttachment(
          membership.clinicId,
          charge.appointment_id,
          arquivo
        )
        attachmentPath = key
      } catch (err) {
        console.error("falha ao subir anexo da guia", err)
        return { error: "Não foi possível anexar o arquivo. Tente de novo." }
      }
    }

    // --- a guia ----------------------------------------------------------
    const guia = await issueServiceGuide(supabase, membership.clinicId, {
      appointmentId: charge.appointment_id,
      insurerId: insurer.id,
      guideNumber: dados.guide_number,
      attachmentUrl: attachmentPath ?? (dados.attachment_url || null),
      createdBy: membership.userId,
    })

    await markAppointmentAsInsured(supabase, membership.clinicId, charge.appointment_id, insurer.id)

    // --- a cobrança do paciente ------------------------------------------
    const valorAvulso = dados.has_extra_charge ? dados.amount : 0
    // Com guia, o paciente não deve nada — quem deve é o convênio. O avulso existe para o
    // caso em que a clínica combina uma cobrança por fora no mesmo atendimento; ele NÃO é
    // mais uma diferença calculada, porque o convênio não declara mais quanto paga. Quem
    // estourou o limite não chega aqui: é cobrado como particular, pelo preço do
    // procedimento, no fluxo normal de pagamento.
    //
    // A auditoria logo abaixo guarda de quanto para quanto, com o número da guia.
    await updateTransactionAmount(supabase, membership.clinicId, transactionId, valorAvulso)

    if (valorAvulso > 0) {
      await registerPayment(supabase, membership.clinicId, {
        transactionId,
        paymentMethodId: dados.payment_method_id as string,
        amount: valorAvulso,
        receivedBy: membership.userId,
        notes: dados.notes ?? `Complemento da guia ${dados.guide_number}`,
      })
    } else {
      // Guia cobre tudo: a cobrança fica em R$ 0,00 e QUITADA. Deixá-la pendente mostraria
      // o paciente como devedor de algo que ele não deve, e o prenderia no gate da fila.
      await settleZeroCharge(supabase, membership.clinicId, transactionId)
    }

    const atualizada = await getTransaction(supabase, membership.clinicId, transactionId)
    if (atualizada.status === "pago") {
      await markQueueEntriesReleasedForTransaction(supabase, membership.clinicId, transactionId)
      revalidatePath("/recepcao/fila")
    }

    await recordAudit({
      clinicId: membership.clinicId,
      userId: membership.userId,
      action: "billing.guide.issue",
      entityType: "service_guide",
      entityId: guia.id,
      before: { patientAmount: Number(charge.amount) },
      after: {
        insurer: insurer.name,
        guideNumber: dados.guide_number,
        patientAmount: valorAvulso,
        hasAttachment: Boolean(attachmentPath),
      },
    })

    revalidatePath("/gestao/financeiro")
    revalidatePath("/recepcao/financeiro")
    return { success: true }
  } catch (err) {
    return { error: describeDbError(err) }
  }
}

/**
 * Quita uma cobrança de R$ 0,00.
 *
 * `registerPayment` não serve: ele grava uma linha em `payments`, e não houve recebimento
 * nenhum — o dinheiro virá do convênio, depois, contra o protocolo. Inventar um pagamento
 * de zero reais poluiria o caixa com um recebimento que não existiu.
 */
async function settleZeroCharge(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  transactionId: string
) {
  const { error } = await supabase
    .from("financial_transactions")
    .update({ status: "pago" })
    .eq("clinic_id", clinicId)
    .eq("id", transactionId)
  if (error) throw error
}
