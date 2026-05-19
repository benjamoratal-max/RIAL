const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Fecha local del navegador (YYYY-MM-DD) para input type="date". */
export function formatLocalToday(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Mínimo seleccionable: hoy en la zona horaria del usuario (sin llamadas al API). */
export function minRentalStartDate(): string {
  return formatLocalToday()
}

export function isTodayOrFutureDate(dateString: string, minDate: string = minRentalStartDate()): boolean {
  if (!dateString || !minDate || !DATE_RE.test(dateString) || !DATE_RE.test(minDate)) return false
  return dateString >= minDate
}
