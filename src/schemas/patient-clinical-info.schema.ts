import { z } from "zod"

/** Form fields are comma-separated text; the schema splits them into arrays for storage. */
const csvToList = z
  .string()
  .trim()
  .optional()
  .transform((value) =>
    value
      ? value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : []
  )

export const patientClinicalInfoSchema = z.object({
  allergies: csvToList,
  chronic_conditions: csvToList,
  current_medications: csvToList,
  relevant_history: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
})

export type PatientClinicalInfoFormInput = z.input<typeof patientClinicalInfoSchema>
