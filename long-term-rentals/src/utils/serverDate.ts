import { apiUrl } from './api'

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
 * Fecha de referencia para alquiler (Render en producción).
 * Usa rutas relativas en Vercel (rewrites) o VITE_API_URL si está definida.
 */
export async function fetchServerToday(): Promise<{ date: string; source: 'server' | 'local' }> {
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
