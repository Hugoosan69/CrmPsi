import { z } from "zod"

export const prescriptionItemSchema = z.object({
  medication_name: z.string().trim().min(1, "Informe o medicamento"),
  concentration: z.string().trim().optional(),
  pharmaceutical_form: z.string().trim().optional(),
  dose: z.string().trim().optional(),
  frequency: z.string().trim().optional(),
  duration: z.string().trim().optional(),
  quantity: z.string().trim().optional(),
  instructions: z.string().trim().optional(),
})

export const prescriptionSchema = z.object({
  notes: z.string().trim().optional(),
  items: z.array(prescriptionItemSchema).min(1, "Adicione ao menos um medicamento"),
})

export type PrescriptionItemInput = z.infer<typeof prescriptionItemSchema>
export type PrescriptionFormInput = z.infer<typeof prescriptionSchema>
