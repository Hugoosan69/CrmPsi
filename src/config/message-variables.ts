/**
 * Variáveis disponíveis nos modelos e campanhas de mensagem.
 *
 * Módulo neutro (sem "use client" nem "server-only") porque as duas pontas precisam da mesma
 * lista: o compositor oferece os blocos para arrastar, e o servidor substitui na hora do
 * envio. Se cada lado tivesse a sua, o operador montaria a mensagem com uma variável que o
 * envio não conhece — e o paciente receberia "{{nome}}" literal no WhatsApp.
 */

export type MessageVariable = {
  /** Chave usada no texto, sem as chaves duplas. */
  key: string
  label: string
  /** O que aparece na pré-visualização, para o operador ver o formato antes de enviar. */
  sample: string
  group: "paciente" | "clinica" | "consulta"
}

export const MESSAGE_VARIABLES: MessageVariable[] = [
  { key: "paciente", label: "Nome do paciente", sample: "Maria Silva", group: "paciente" },
  {
    key: "primeiro_nome",
    label: "Primeiro nome",
    sample: "Maria",
    group: "paciente",
  },
  { key: "telefone", label: "Telefone", sample: "(61) 99999-0000", group: "paciente" },
  { key: "clinica", label: "Nome da clínica", sample: "CSIB", group: "clinica" },
  { key: "data", label: "Data da consulta", sample: "12/03/2026", group: "consulta" },
  { key: "hora", label: "Horário", sample: "14:30", group: "consulta" },
  {
    key: "profissional",
    label: "Profissional",
    sample: "Dra. Ana Costa",
    group: "consulta",
  },
  {
    key: "procedimento",
    label: "Procedimento",
    sample: "Consulta clínica",
    group: "consulta",
  },
]

export const VARIABLE_GROUP_LABEL: Record<MessageVariable["group"], string> = {
  paciente: "Paciente",
  clinica: "Clínica",
  consulta: "Consulta",
}

/** Como a variável aparece dentro do texto. */
export function variableToken(key: string) {
  return `{{${key}}}`
}

/**
 * Substitui as variáveis por valores.
 *
 * Uma chave sem valor vira string vazia em vez de continuar como `{{...}}`: o operador
 * errando o nome de uma variável é um erro de configuração, mas mandar chaves duplas para o
 * paciente transforma isso numa mensagem constrangedora. O aviso fica na tela, na
 * pré-visualização, onde ainda dá para corrigir.
 */
export function renderTemplate(template: string, values: Record<string, string | null>) {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) => {
    const value = values[key.toLowerCase()]
    return value ?? ""
  })
}

/** Variáveis usadas num texto que não existem na lista — para a tela avisar antes do envio. */
export function unknownVariables(template: string): string[] {
  const known = new Set(MESSAGE_VARIABLES.map((v) => v.key))
  const found = new Set<string>()
  for (const match of template.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)) {
    const key = match[1].toLowerCase()
    if (!known.has(key)) found.add(key)
  }
  return [...found]
}

/** Valores de exemplo, para a pré-visualização. */
export function sampleValues(): Record<string, string> {
  return Object.fromEntries(MESSAGE_VARIABLES.map((v) => [v.key, v.sample]))
}

/**
 * Renderiza e informa quais variáveis ficaram vazias.
 *
 * Existe porque a pré-visualização usa valores de exemplo e por isso mostra sempre uma frase
 * completa — dando a impressão de que o envio sairá igual. Para um paciente sem consulta
 * futura, `{{data}}`, `{{hora}}` e `{{profissional}}` resolvem para vazio e o texto vira
 * "marcada para  às  com ." Quem decide o que fazer com isso é o chamador; o que esta
 * função garante é que ninguém precise adivinhar.
 */
export function renderWithMissing(
  template: string,
  values: Record<string, string | null>
): { body: string; missing: string[] } {
  const missing = new Set<string>()
  const body = template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, raw: string) => {
    const key = raw.toLowerCase()
    const value = values[key]
    if (!value) {
      missing.add(key)
      return ""
    }
    return value
  })
  return { body, missing: [...missing] }
}

/** Variáveis que dependem de uma consulta futura existir. */
export const APPOINTMENT_VARIABLES = ["data", "hora", "profissional", "procedimento"]

/**
 * O texto usa alguma variável de consulta?
 *
 * Reaproveita a mesma varredura de `unknownVariables` em vez de montar um regex por chave:
 * construir o padrão dentro de template literal fazia `\s` virar `s` na string final,
 * produzindo `{{s*datas*}}` — que acerta `{{data}}` por acidente (porque `s*` casa vazio) e
 * erra `{{ data }}` com espaços.
 */
export function usesAppointmentVariables(template: string) {
  for (const match of template.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)) {
    if (APPOINTMENT_VARIABLES.includes(match[1].toLowerCase())) return true
  }
  return false
}
