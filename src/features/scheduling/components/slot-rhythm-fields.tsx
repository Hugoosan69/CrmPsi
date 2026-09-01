"use client"

import { useState } from "react"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * O passo da grade e a opção de atender seguido, juntos.
 *
 * Estão no mesmo componente porque um desliga o outro: com "atender seguido" marcado, o
 * passo deixa de ter efeito — quem manda passa a ser a duração do procedimento. Deixar o
 * seletor ativo e sem efeito seria a pior combinação, porque a pessoa configura 30 minutos,
 * salva, e a agenda ignora.
 *
 * O valor viaja num input escondido, não no `name` do seletor. Campo desabilitado não é
 * enviado pelo formulário, e sem o valor a validação recusaria o cadastro inteiro por falta
 * de `slot_minutes` — um erro que não tem nada a ver com o que a pessoa fez.
 */
export function SlotRhythmFields({
  idPrefix,
  label,
  options,
  defaultValue = "30",
}: {
  idPrefix: string
  /** As duas telas nomeiam este campo de formas diferentes; cada uma mantém a sua. */
  label: string
  options: number[]
  defaultValue?: string
}) {
  const [slot, setSlot] = useState(defaultValue)
  const [seguido, setSeguido] = useState(false)

  return (
    <>
      <input type="hidden" name="slot_minutes" value={slot} />

      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-slot`}>{label}</Label>
        <Select value={slot} onValueChange={(v) => setSlot(v ?? slot)} disabled={seguido}>
          <SelectTrigger id={`${idPrefix}-slot`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {m} minutos
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <label className="flex items-start gap-2.5 text-sm" htmlFor={`${idPrefix}-seguido`}>
        <input
          id={`${idPrefix}-seguido`}
          type="checkbox"
          name="back_to_back"
          className="mt-0.5"
          checked={seguido}
          onChange={(e) => setSeguido(e.target.checked)}
        />
        <span>
          Atender seguido, sem intervalo
          <span className="block text-[0.78rem] text-muted-foreground">
            Cada paciente começa quando o anterior termina.
          </span>
        </span>
      </label>
    </>
  )
}
