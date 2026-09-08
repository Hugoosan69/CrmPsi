import "server-only"

/**
 * O e-mail que leva a guia ao paciente.
 *
 * HTML de e-mail não é HTML de página. O que está aqui obedece às restrições dos clientes
 * de e-mail, e cada uma delas custou a alguém uma mensagem quebrada:
 *
 *  - **Tabelas para layout.** Outlook renderiza com o motor do Word, que não implementa
 *    flexbox nem grid. `<table>` é o único container que se comporta em todos.
 *  - **Estilo inline.** Gmail remove `<style>` no corpo da mensagem; classe CSS não
 *    sobrevive à entrega.
 *  - **Sem imagem.** A maioria dos clientes bloqueia imagem remota por padrão, e um
 *    cabeçalho que só aparece depois de "exibir imagens" é um cabeçalho que ninguém vê.
 *    O nome da clínica vai como texto.
 *  - **Largura fixa de 600px.** É o que cabe no painel de leitura do Outlook sem cortar.
 *
 * Vai também uma versão em texto puro: cliente que não renderiza HTML mostraria a marcação
 * crua, e filtro de spam pontua melhor mensagem com as duas partes.
 */

export type GuideEmailInput = {
  clinicName: string
  patientName: string
  guideNumber: string | null
  insurerName: string
  /** Data do atendimento, já formatada para leitura. */
  appointmentDate: string | null
  link: string
  /** Horas de validade do link — dito ao paciente, não deduzido por ele. */
  expiresInHours: number
}

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function guideEmailSubject(input: GuideEmailInput): string {
  return input.guideNumber
    ? `Sua guia ${input.guideNumber} — ${input.clinicName}`
    : `Sua guia de atendimento — ${input.clinicName}`
}

export function guideEmailHtml(input: GuideEmailInput): string {
  // Escapado sem exceção: nome de paciente e número de guia são digitados por pessoas, e
  // este texto vira HTML na caixa de entrada de alguém.
  const clinica = escaparHtml(input.clinicName)
  const paciente = escaparHtml(input.patientName)
  const convenio = escaparHtml(input.insurerName)
  const numero = input.guideNumber ? escaparHtml(input.guideNumber) : null
  const data = input.appointmentDate ? escaparHtml(input.appointmentDate) : null

  const linha = (rotulo: string, valor: string) => `
              <tr>
                <td style="padding:6px 0;color:#64748b;font-size:13px;">${rotulo}</td>
                <td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;text-align:right;">${valor}</td>
              </tr>`

  return `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background-color:#f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
          <tr>
            <td style="background-color:#0B3D5C;padding:20px 28px;">
              <p style="margin:0;color:#ffffff;font-size:16px;font-weight:600;">${clinica}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 14px;color:#0f172a;font-size:15px;">Olá, ${paciente}.</p>
              <p style="margin:0 0 20px;color:#334155;font-size:14px;line-height:1.6;">
                Segue a guia do seu atendimento. Use o botão abaixo para visualizar ou baixar
                o documento.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border-radius:8px;padding:14px 16px;margin:0 0 22px;">
                ${numero ? linha("Número da guia", numero) : ""}
                ${linha("Convênio", convenio)}
                ${data ? linha("Atendimento", data) : ""}
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 20px;">
                <tr>
                  <td style="background-color:#0B3D5C;border-radius:8px;">
                    <a href="${input.link}" style="display:inline-block;padding:12px 26px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">Ver a guia</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px;color:#b45309;font-size:13px;line-height:1.6;text-align:center;">
                Este link vale por ${input.expiresInHours} horas.
              </p>
              <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;text-align:center;">
                Depois disso ele deixa de funcionar. Se precisar de novo, é só pedir à
                clínica — por segurança, o documento não fica em endereço permanente.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;padding:16px 28px;">
              <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.6;">
                Mensagem enviada por ${clinica}. Se você não reconhece este atendimento,
                ignore este e-mail e avise a clínica.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function guideEmailText(input: GuideEmailInput): string {
  const linhas = [
    `Olá, ${input.patientName}.`,
    "",
    "Segue a guia do seu atendimento.",
    "",
    input.guideNumber ? `Número da guia: ${input.guideNumber}` : null,
    `Convênio: ${input.insurerName}`,
    input.appointmentDate ? `Atendimento: ${input.appointmentDate}` : null,
    "",
    `Ver a guia: ${input.link}`,
    "",
    `Este link vale por ${input.expiresInHours} horas. Depois disso ele deixa de funcionar;`,
    "por segurança, o documento não fica em endereço permanente.",
    "",
    input.clinicName,
  ]
  return linhas.filter((l) => l !== null).join("\n")
}
