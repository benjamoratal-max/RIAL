/**
 * Genera vercel.json en build para proxyear /api al backend en Render.
 * En Vercel, define VITE_API_URL o RENDER_API_URL con la URL del servicio (ej. https://tu-api.onrender.com).
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const api = (process.env.VITE_API_URL || process.env.RENDER_API_URL || '')
  .trim()
  .replace(/\/$/, '')

if (!api) {
  console.warn(
    '[vercel] Sin VITE_API_URL ni RENDER_API_URL: no se genera vercel.json. ' +
      'En Vercel define RENDER_API_URL (proxy) o VITE_API_URL (llamada directa + CORS en Render).'
  )
  process.exit(0)
}

const config = {
  rewrites: [
    { source: '/api/:path*', destination: `${api}/api/:path*` },
    { source: '/health', destination: `${api}/health` },
    { source: '/server-date', destination: `${api}/server-date` },
    { source: '/contracts/:path*', destination: `${api}/contracts/:path*` },
  ],
}

fs.writeFileSync(path.join(root, 'vercel.json'), JSON.stringify(config, null, 2))
console.log('[vercel] vercel.json generado → proxy /api →', api)
