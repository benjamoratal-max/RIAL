/**
 * Añade rewrites de API al vercel.json del frontend (no sobrescribe build/install).
 * En Vercel, define VITE_API_URL o RENDER_API_URL con la URL del backend en Render.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.join(__dirname, '..')
const vercelPath = path.join(frontendRoot, 'vercel.json')

const api = (process.env.VITE_API_URL || process.env.RENDER_API_URL || '')
  .trim()
  .replace(/\/$/, '')

if (!api) {
  console.warn(
    '[vercel] Sin VITE_API_URL ni RENDER_API_URL: no se actualizan rewrites. ' +
      'En Vercel define RENDER_API_URL (proxy) o VITE_API_URL (llamada directa + CORS en Render).'
  )
  process.exit(0)
}

let config = {}
if (fs.existsSync(vercelPath)) {
  try {
    config = JSON.parse(fs.readFileSync(vercelPath, 'utf8'))
  } catch {
    console.warn('[vercel] vercel.json inválido; se regenerará solo con rewrites.')
  }
}

config.rewrites = [
  { source: '/api/:path*', destination: `${api}/api/:path*` },
  { source: '/health', destination: `${api}/health` },
  { source: '/server-date', destination: `${api}/server-date` },
  { source: '/contracts/:path*', destination: `${api}/contracts/:path*` },
]

fs.writeFileSync(vercelPath, JSON.stringify(config, null, 2))
console.log('[vercel] vercel.json actualizado → proxy /api →', api)
