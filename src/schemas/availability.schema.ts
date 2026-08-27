import { z } from "zod"

import { CLINIC_UTC_OFFSET } from "@/utils/datetime"

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))

const optionalUuid = z
  .string()
  .uuid()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null))

/** Same treatment as appointment.schema.ts: make the clinic's offset explicit. */
const localDateTimeToIso = z
  .string()
  .min(1, "Informe data e horário")
  .transform((value) => {
    const withSeconds = value.length === 16 ? `${value}:00` : value
    return `${withSeconds}${CLINIC_UTC_OFFSET}`
  })

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido")
  .transform((v) => `${v}:00`)

export const roomSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da sala"),
  kind: z.string().trim().min(1).default("consultorio"),
  capacity: z.coerce.number().int().min(1, "Capacidade mínima de 1"),
  notes: optionalText,
})

export const availabilitySchema = z
  .object({
    professional_id: z.string().uuid("Selecione um profissional"),
    weekday: z.coerce.number().int().min(0).max(6),
    start_time: time,
    end_time: time,
    slot_minutes: z.coerce
      .number()
      .int()
      .min(5, "Intervalo mínimo de 5 minutos")
      .max(480, "Intervalo máximo de 8 horas"),
    room_id: optionalUuid,
  })
  .refine((v) => v.end_time > v.start_time, {
    message: "O fim precisa ser depois do início",
    path: ["end_time"],
  })

export const scheduleExceptionSchema = z
  .object({
    professional_id: optionalUuid,
    kind: z.enum(["block", "extra"]),
    starts_at: localDateTimeToIso,
    ends_at: localDateTimeToIso,
    reason: optionalText,
  })
  .refine((v) => v.ends_at > v.starts_at, {
    message: "O fim precisa ser depois do início",
    path: ["ends_at"],
  })

export type RoomFormInput = z.input<typeof roomSchema>
export type AvailabilityFormInput = z.input<typeof availabilitySchema>
export type ScheduleExceptionFormInput = z.input<typeof scheduleExceptionSchema>
