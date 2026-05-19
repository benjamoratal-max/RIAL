/**
 * Falla el build si el bundle de producción aún contiene el bug de fechas del servidor.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(__dirname, '..', 'dist')
const forbidden = [
  'No se pudo verificar la fecha con el servidor',
  'No se pudo obtener la fecha del servidor',
  'fetchServerToday',
  'serverDateError',
]

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    if (fs.statSync(full).isDirectory()) walk(full, files)
    else if (/\.(js|css|html)$/i.test(name)) files.push(full)
  }
  return files
}

const hits = []
for (const file of walk(dist)) {
  const text = fs.readFileSync(file, 'utf8')
  for (const phrase of forbidden) {
    if (text.includes(phrase)) hits.push({ file, phrase })
  }
}

if (hits.length) {
  console.error('[verify-build] El bundle aún contiene código del bug de fechas:')
  for (const h of hits) console.error(`  - "${h.phrase}" en ${h.file}`)
  process.exit(1)
}

console.log('[verify-build] OK: sin mensajes de fecha del servidor en dist/')
