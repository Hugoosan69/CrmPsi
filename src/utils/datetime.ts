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

/**
 * The clinic's fixed UTC offset, written explicitly onto every timestamptz literal we
 * send to Postgres. Without it PostgREST resolves a naive `YYYY-MM-DDTHH:mm:ss` in the
 * *session* timezone (UTC), which silently shifts every query window three hours away
 * from the wall-clock day the user asked for — while the write side
 * (schemas/appointment.schema.ts) correctly stamps the offset. Both sides must agree.
 */
export const CLINIC_UTC_OFFSET = "-03:00"

/** Window covering one clinic-local calendar day, safe to compare against timestamptz. */
export function dayRange(date: string) {
  return {
    start: `${date}T00:00:00${CLINIC_UTC_OFFSET}`,
    end: `${date}T23:59:59.999${CLINIC_UTC_OFFSET}`,
  }
}

/** First instant of the clinic-local month containing `date` (accepts `YYYY-MM-DD`). */
export function monthStart(date: string) {
  return `${date.slice(0, 7)}-01T00:00:00${CLINIC_UTC_OFFSET}`
}

/** Pure YYYY-MM-DD arithmetic, done in UTC so it never depends on the process timezone. */
export function addDays(date: string, delta: number) {
  const [y, m, d] = date.split("-").map(Number)
  const shifted = new Date(Date.UTC(y, m - 1, d + delta))
  return shifted.toISOString().slice(0, 10)
}

/** Monday of the week containing `date` — the week the clinic actually thinks in. */
export function startOfWeek(date: string) {
  const [y, m, d] = date.split("-").map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sunday
  const backToMonday = dow === 0 ? 6 : dow - 1
  return addDays(date, -backToMonday)
}

/** Window spanning several clinic-local days, inclusive of both ends. */
export function rangeBounds(fromDate: string, toDate: string) {
  return {
    start: `${fromDate}T00:00:00${CLINIC_UTC_OFFSET}`,
    end: `${toDate}T23:59:59.999${CLINIC_UTC_OFFSET}`,
  }
}

/** Clinic-local `YYYY-MM-DD` of a stored timestamp — for bucketing into calendar columns. */
export function toClinicDate(iso: string) {
  const { year, month, day } = toSaoPauloParts(iso)
  return `${year}-${pad(month)}-${pad(day)}`
}

/** Minutes since clinic-local midnight — the vertical coordinate in a calendar grid. */
export function minutesSinceMidnight(iso: string) {
  const { hours, minutes } = toSaoPauloParts(iso)
  return hours * 60 + minutes
}

/** "08:00:00" / "08:00" -> 480. */
export function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + (m || 0)
}

export function minutesToTime(total: number) {
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

/**
 * Short relative time for feeds — "agora", "12 min", "3 h", "ontem", then a date.
 * Deliberately coarse: a notification list wants scannable age, not precision.
 */
export function formatRelativeTime(iso: string, now = Date.now()) {
  const elapsedMs = now - new Date(iso).getTime()
  const minutes = Math.floor(elapsedMs / 60_000)

  if (minutes < 1) return "agora"
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h`

  const days = Math.floor(hours / 24)
  if (days === 1) return "ontem"
  if (days < 7) return `${days} dias`

  return formatDate(iso)
}
