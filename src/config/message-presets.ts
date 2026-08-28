import type { MessageType } from "@/types/supabase"

/**
 * Modelos prontos, para a clínica não começar de uma caixa de texto vazia.
 *
 * Escritos no tom que o paciente espera receber de uma clínica: direto, sem exclamação
 * excessiva, e sempre identificando a origem logo no começo — uma mensagem que começa com
 * "Olá!" e só menciona a clínica no fim parece golpe, e o paciente não lê até lá.
 *
 * Todos usam as variáveis reais de src/config/message-variables.ts. Nenhum inventa dado que
 * o sistema não tem.
 */

export type MessagePreset = {
  id: string
  label: string
  /** Para que serve — aparece na tela, não na mensagem. */
  hint: string
  type: MessageType
  subject?: string
  body: string
}

export const MESSAGE_PRESETS: MessagePreset[] = [
  {
    id: "confirmacao",
    label: "Confirmação de consulta",
    hint: "Pede que o paciente confirme presença.",
    type: "confirmation",
    subject: "Confirme sua consulta na {{clinica}}",
    body: `{{clinica}} — confirmação de consulta

Olá, {{primeiro_nome}}. Sua consulta está marcada para {{data}} às {{hora}} com {{profissional}}.

Pode confirmar respondendo esta mensagem? Se precisar remarcar, é só avisar.`,
  },
  {
    id: "lembrete",
    label: "Lembrete de consulta",
    hint: "Enviado perto da data, reduz falta.",
    type: "reminder",
    subject: "Lembrete: sua consulta é {{data}}",
    body: `{{clinica}} — lembrete

{{primeiro_nome}}, passando para lembrar da sua consulta amanhã, {{data}} às {{hora}}, com {{profissional}}.

Chegue com 10 minutos de antecedência. Se não puder vir, avise para liberarmos o horário.`,
  },
  {
    id: "aniversario",
    label: "Aniversário",
    hint: "Uma mensagem no dia, sem vender nada.",
    type: "birthday",
    subject: "Feliz aniversário, {{primeiro_nome}}",
    body: `{{primeiro_nome}}, a equipe da {{clinica}} deseja um feliz aniversário.

Que o novo ano seja de saúde. Estamos por aqui quando precisar.`,
  },
  {
    id: "avaliacao",
    label: "Pedido de avaliação",
    hint: "Depois do atendimento, pergunta como foi.",
    type: "post_visit",
    subject: "Como foi seu atendimento?",
    body: `{{primeiro_nome}}, obrigado por escolher a {{clinica}}.

Como foi seu atendimento com {{profissional}}? Responda com uma nota de 1 a 5 — sua resposta ajuda a melhorar.`,
  },
  {
    id: "retorno",
    label: "Convite de retorno",
    hint: "Para pacientes inativos, sem soar cobrança.",
    type: "general",
    subject: "Faz um tempo que não nos vemos",
    body: `{{primeiro_nome}}, aqui é a {{clinica}}.

Faz um tempo desde seu último atendimento. Se quiser retomar o acompanhamento, é só responder esta mensagem que agendamos.`,
  },
  {
    id: "promocao",
    label: "Promoção ou campanha",
    hint: "Para uma condição especial com prazo.",
    type: "general",
    subject: "Condição especial na {{clinica}}",
    body: `{{clinica}} — condição especial

{{primeiro_nome}}, estamos com uma condição especial em [descreva aqui] até [data].

Para aproveitar, responda esta mensagem e agendamos seu horário.`,
  },
  {
    id: "evento",
    label: "Aviso de evento",
    hint: "Palestra, mutirão, dia especial.",
    type: "general",
    subject: "Convite: [nome do evento]",
    body: `{{clinica}} — convite

{{primeiro_nome}}, vamos realizar [nome do evento] no dia [data], às [hora], aqui na clínica.

A participação é gratuita e as vagas são limitadas. Responda para reservar a sua.`,
  },
  {
    id: "recesso",
    label: "Aviso de recesso",
    hint: "Feriado, férias coletivas, mudança de horário.",
    type: "general",
    subject: "Nosso funcionamento em [período]",
    body: `{{clinica}} — aviso

{{primeiro_nome}}, informamos que a clínica estará fechada de [data inicial] a [data final].

Retomamos os atendimentos em [data]. Urgências, ligue para [telefone].`,
  },
]

/** Trechos entre colchetes que o operador precisa preencher antes de enviar. */
export function unfilledPlaceholders(body: string): string[] {
  return [...body.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1])
}
