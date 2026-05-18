const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Fecha local del navegador en formato YYYY-MM-DD (input type="date"). */
export function formatLocalToday(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Fecha mínima para inicio de alquiler: hoy en la zona horaria del usuario. */
export function minRentalStartDate(): string {
  return formatLocalToday()
}

export function isTodayOrFutureDate(dateString: string, minDate: string = minRentalStartDate()): boolean {
  if (!dateString || !minDate || !DATE_RE.test(dateString) || !DATE_RE.test(minDate)) return false
  return dateString >= minDate
}

async function tryFetchDate(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    if (typeof data?.date === 'string' && DATE_RE.test(data.date)) return data.date
    if (typeof data?.today === 'string' && DATE_RE.test(data.today)) return data.today
    if (typeof data?.timestamp === 'string') {
      const fromTs = data.timestamp.slice(0, 10)
      if (DATE_RE.test(fromTs)) return fromTs
    }
    return null
  } catch {
    return null
  }
}

/** @deprecated El proceso de alquiler usa fecha local; se mantiene por si otros módulos lo necesitan. */
export async function fetchServerToday(): Promise<{ date: string; source: 'server' | 'local' }> {
  const { apiUrl } = await import('./api')
  const urls = [apiUrl('/api/server-date'), apiUrl('/server-date'), apiUrl('/health')]

  if (import.meta.env.DEV) {
    urls.push('http://127.0.0.1:3000/api/server-date', 'http://localhost:3000/api/server-date')
  }

  const seen = new Set<string>()
  for (const url of urls) {
    if (seen.has(url)) continue
    seen.add(url)
    const date = await tryFetchDate(url)
    if (date) return { date, source: 'server' }
  }

  return { date: formatLocalToday(), source: 'local' }
}
