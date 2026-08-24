const SAO_PAULO_OFFSET_MS = 3 * 60 * 60 * 1000

/**
 * Formats a stored UTC timestamp as America/Sao_Paulo wall-clock time, using fixed math
 * (not Intl/date-fns-tz) since Brazil has had one DST-free offset since 2019 — see
 * schemas/appointment.schema.ts for the write-side counterpart of this same assumption.
 * Uses UTC getters throughout so the result never depends on the server process's own
 * local timezone.
 */
function toSaoPauloParts(iso: string) {
  const shifted = new Date(new Date(iso).getTime() - SAO_PAULO_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
  }
}

function pad(n: number) {
  return String(n).padStart(2, "0")
}

/** For `<input type="datetime-local">` defaultValue. */
export function toDateTimeLocalValue(iso: string) {
  const { year, month, day, hours, minutes } = toSaoPauloParts(iso)
  return `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}`
}

export function formatDateTime(iso: string) {
  const { year, month, day, hours, minutes } = toSaoPauloParts(iso)
  return `${pad(day)}/${pad(month)}/${year} ${pad(hours)}:${pad(minutes)}`
}

/** Date portion only of a timestamptz, in America/Sao_Paulo — not for plain `date` columns
 * like patients.birth_date, which have no timezone to begin with. */
export function formatDate(iso: string) {
  const { year, month, day } = toSaoPauloParts(iso)
  return `${pad(day)}/${pad(month)}/${year}`
}

export function formatTime(iso: string) {
  const { hours, minutes } = toSaoPauloParts(iso)
  return `${pad(hours)}:${pad(minutes)}`
}

export function todaySaoPauloDate() {
  const { year, month, day } = toSaoPauloParts(new Date().toISOString())
  return `${year}-${pad(month)}-${pad(day)}`
}
