# RIAL keep-alive (Cloudflare Worker)

Mantiene **despierto 24/7** el backend de Render (plan free) para eliminar la
lentitud de la **primera carga del día** (cold start).

## ¿Por qué esto soluciona el problema de raíz?

Render apaga el servidor tras **~15 min** sin tráfico; despertarlo tarda **30–60 s**.
Este Worker le pega a `/health` **cada 5 minutos, todo el día** (5 min < 15 min),
así el servidor **nunca llega a dormirse** → **cero cold starts** → la primera
carga siempre es rápida.

A diferencia de un pinger externo (UptimeRobot/cron-job.org) que se puede pausar
en silencio, este keep-alive:

- Corre en la red de **Cloudflare** (cron triggers muy fiables).
- Queda **versionado en el repo** (reproducible, sin "configurar a mano" en una web).
- Es **gratis** (entra de sobra en el plan free de Cloudflare Workers).

## Deploy (una sola vez, ~2 minutos)

Necesitás una cuenta de Cloudflare (gratis). Desde esta carpeta:

```bash
cd keep-alive-worker
npm install            # opcional: instala wrangler localmente
npx wrangler login     # abre el navegador para conectar tu cuenta Cloudflare
npx wrangler deploy
```

Al terminar, el deploy imprime la URL pública del Worker
(`https://rial-keep-alive.<tu-subdominio>.workers.dev`) y el cron queda activo.
**No tenés que volver a tocar nada.**

## Verificar que funciona

1. **Ping manual:** abrí la URL del Worker en el navegador. Debería responder
   `{"ok": true, "status": 200, ...}`.
2. **Cron activo:** en el dashboard de Cloudflare → **Workers & Pages** →
   `rial-keep-alive` → pestaña **Triggers**, deberías ver el cron `*/5 * * * *`.
3. **Logs en vivo (opcional):** `npx wrangler tail` y esperá unos minutos; vas a
   ver `Backend despierto (intento 1 → HTTP 200)` cada 5 min.
4. **Prueba real:** a la mañana siguiente, sin que nadie haya entrado, abrí la app:
   las propiedades deberían cargar rápido (sin la espera de 30–60 s).

## Si cambia el dominio del backend

Editá `HEALTH_URL` en [`wrangler.toml`](./wrangler.toml) y volvé a correr
`npx wrangler deploy`.

## Notas

- **Cuota Render:** el plan free da 750 h/mes de instancia; un mes tiene ~730 h,
  así que **un único** servicio siempre despierto entra dentro del límite gratis.
- El antiguo `.github/workflows/keep-backend-awake.yml` queda solo como backup
  manual; con este Worker ya no hace falta el cron de GitHub Actions.
