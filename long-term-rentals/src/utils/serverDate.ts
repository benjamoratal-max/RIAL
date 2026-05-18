import { getApiBase } from './api'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Fecha local YYYY-MM-DD (respaldo si el API no responde). */
export function formatLocalToday(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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

/**
 * Obtiene la fecha de referencia para validar inicio de alquiler.
 * Prueba varias URLs (proxy Vite, VITE_API_URL, localhost en dev) y, si todo falla, usa la fecha local.
 */
export async function fetchServerToday(): Promise<{ date: string; source: 'server' | 'local' }> {
  const bases = new Set<string>()
  const configured = getApiBase().replace(/\/$/, '')
  if (configured) bases.add(configured)
  if (import.meta.env.DEV) {
    bases.add('http://127.0.0.1:3000')
    bases.add('http://localhost:3000')
  }

  const urls: string[] = []
  for (const base of bases) {
    urls.push(`${base}/api/server-date`, `${base}/server-date`, `${base}/health`)
  }
  urls.push('/api/server-date', '/server-date', '/health')

  for (const url of urls) {
    const date = await tryFetchDate(url)
    if (date) return { date, source: 'server' }
  }

  return { date: formatLocalToday(), source: 'local' }
}
