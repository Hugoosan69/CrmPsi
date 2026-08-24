import { z } from "zod"

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))

export const medicalRecordSchema = z.object({
  chief_complaint: optionalText,
  history: optionalText,
  exam: optionalText,
  assessment: optionalText,
  plan: optionalText,
  notes: optionalText,
})

export type MedicalRecordFormInput = z.input<typeof medicalRecordSchema>
