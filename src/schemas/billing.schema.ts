import { z } from "zod"

/**
 * Convênio.
 *
 * Sem valor por guia desde a migration 032 — o que o convênio paga só se sabe no acerto.
 * O que fica no cadastro são as duas regras que precisam valer no balcão, na hora:
 *
 *   `max_guides_per_patient_month`  quantas guias o paciente pode usar no mês (vazio = sem limite)
 *   `procedure_ids`                 que procedimentos este convênio cobre (vazio = todos)
 */
export const insurerSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(120, "Nome muito longo"),
  // Campo vazio é "sem limite", não zero: zero descreveria um convênio que não aceita guia
  // nenhuma, que não é o mesmo que um convênio sem teto combinado.
  max_guides_per_patient_month: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : Number(v)))
    .refine(
      (v) => v === null || (Number.isInteger(v) && v > 0),
      "Informe um número inteiro maior que zero, ou deixe vazio para sem limite"
    ),
  contact_name: z.string().trim().max(160).optional().nullable(),
  contact_email: z.string().trim().max(160).optional().nullable(),
  contact_phone: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
})

export type InsurerFormInput = z.infer<typeof insurerSchema>

/**
 * Os procedimentos marcados no formulário.
 *
 * Fora do `insurerSchema` porque chegam como CAMPO REPETIDO no FormData
 * (`procedure_ids` uma vez por caixa marcada), e `Object.fromEntries` — que é como o resto
 * do projeto lê formulário — colapsa repetição no último valor. Quem chama usa
 * `formData.getAll`, e é por isso que isto é uma função e não mais uma chave do objeto.
 */
export function parseProcedureIds(values: FormDataEntryValue[]): string[] {
  return z
    .array(z.string().uuid())
    .catch([])
    .parse(values.filter((v): v is string => typeof v === "string"))
}
