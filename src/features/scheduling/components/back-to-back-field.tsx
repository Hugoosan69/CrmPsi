"use client"

/**
 * A opção de atender seguido, sem intervalo entre um paciente e o próximo.
 *
 * Compartilhada entre a tela da gestão e a do próprio profissional para as duas explicarem a
 * mesma coisa com as mesmas palavras — é uma configuração cujo efeito não se adivinha pelo
 * nome, e duas explicações diferentes viram duas interpretações diferentes.
 *
 * A explicação é concreta de propósito. "Encaixes seguem a duração do procedimento" não diz
 * nada a quem opera; "termina 08:50, o próximo começa 08:50" diz.
 */
export function BackToBackField({
  id,
  defaultChecked = false,
}: {
  id: string
  defaultChecked?: boolean
}) {
  return (
    <fieldset className="grid gap-2 rounded-lg border border-border p-3">
      <legend className="px-1 text-[0.8rem] font-medium">Ritmo do atendimento</legend>
      <label className="flex items-start gap-2.5 text-sm" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          name="back_to_back"
          className="mt-1"
          defaultChecked={defaultChecked}
        />
        <span>
          Atender seguido, sem intervalo
          <span className="block text-[0.78rem] text-muted-foreground">
            Cada paciente começa quando o anterior termina: uma consulta de 50 minutos às
            08:00 libera o próximo horário às 08:50, em vez de esperar a próxima marca da
            grade. Deixe desmarcado para manter um respiro entre os atendimentos.
          </span>
        </span>
      </label>
    </fieldset>
  )
}
