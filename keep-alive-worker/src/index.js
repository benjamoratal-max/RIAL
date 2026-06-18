/**
 * Keep-alive del backend de RIAL (Render plan free).
 *
 * Render apaga el servidor tras ~15 min sin tráfico; despertarlo tarda 30–60 s
 * (eso es la "primera carga lenta del día"). Este Worker le pega a /health cada
 * 5 minutos para que nunca se duerma.
 *
 * - `scheduled`: lo invoca el cron trigger de Cloudflare (ver wrangler.toml).
 * - `fetch`: permite probar el ping a mano abriendo la URL del Worker en el navegador.
 */

const DEFAULT_HEALTH_URL = 'https://rial-zwv8.onrender.com/health'
const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 10_000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function pingBackend(env) {
  const url = (env && env.HEALTH_URL) || DEFAULT_HEALTH_URL

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        // Evitar cualquier caché intermedia: queremos golpear el origen y despertarlo.
        cf: { cacheTtl: 0, cacheEverything: false },
        headers: { 'Cache-Control': 'no-cache' },
      })
      const message = `intento ${attempt} → HTTP ${res.status}`
      if (res.ok) {
        console.log(`Backend despierto (${message})`)
        return { ok: true, status: res.status, attempt }
      }
      console.log(`Respuesta no OK (${message})`)
    } catch (err) {
      console.log(`intento ${attempt} → error: ${err && err.message ? err.message : err}`)
    }

    // El backend puede estar despertando: esperamos y reintentamos.
    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS)
  }

  return { ok: false, status: 0, attempt: MAX_ATTEMPTS }
}

export default {
  // Cron trigger (cada 5 min). waitUntil mantiene vivo el Worker mientras
  // esperamos a que el backend responda (puede tardar si estaba dormido).
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(pingBackend(env))
  },

  // Acceso manual: abrir la URL del Worker dispara un ping y muestra el resultado.
  async fetch(_request, env) {
    const result = await pingBackend(env)
    return new Response(JSON.stringify(result, null, 2), {
      status: result.ok ? 200 : 502,
      headers: { 'Content-Type': 'application/json' },
    })
  },
}
