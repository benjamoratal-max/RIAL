# Mantener el backend despierto 24/7 (eliminar la lentitud de la primera carga)

## El problema

El backend está en **Render plan gratuito** (`https://rial-zwv8.onrender.com`).
Render **apaga el servidor tras ~15 min sin tráfico**. La siguiente visita tiene
que **despertarlo, y eso tarda 30–60 segundos**. Eso es lo que el usuario siente
como "tarda mucho en cargar las propiedades" en la primera carga.

> Cuando el servidor está despierto, las propiedades cargan en ~1,6 s. El único
> problema real es el cold start. La solución es **que el servidor nunca se duerma**.

## La solución: un pinger externo cada 5 minutos

Un servicio gratuito le pega a `/health` cada 5 minutos, 24 horas. Como 5 min < 15 min,
Render **nunca llega a dormirse** → cero cold starts → la primera carga es siempre rápida.

> **Nota de cuota Render:** el plan gratuito da 750 horas/mes de instancia. Un mes
> tiene ~730 horas, así que **un solo** servicio siempre despierto entra dentro del
> límite gratuito. (Si tuvieras varios servicios free siempre activos, sí lo superarías.)

---

## Opción A — UptimeRobot (recomendado, 5 min)

1. Entrá a **https://uptimerobot.com** y creá una cuenta gratis.
2. Confirmá tu email e iniciá sesión.
3. Tocá **"+ Add New Monitor"**.
4. Completá:
   - **Monitor Type:** `HTTP(s)`
   - **Friendly Name:** `RIAL backend keep-alive`
   - **URL (or IP):** `https://rial-zwv8.onrender.com/health`
   - **Monitoring Interval:** `5 minutes` (es el mínimo del plan gratis; alcanza)
5. **"Create Monitor"**.

Listo. En unos minutos el monitor pasa a **"Up"** y el servidor queda despierto 24/7.

---

## Opción B — cron-job.org (alternativa, permite cada 1 min)

1. Entrá a **https://cron-job.org** y creá una cuenta gratis.
2. **"Create cronjob"**.
3. Completá:
   - **Title:** `RIAL keep-alive`
   - **URL:** `https://rial-zwv8.onrender.com/health`
   - **Schedule:** cada **5 minutos** (o cada 10; cualquiera < 15 sirve).
4. Guardá. Verificá en el historial que devuelve **HTTP 200**.

---

## Cómo verificar que funciona

1. Esperá a tener el monitor activo unos 20–30 min.
2. Sin abrir la app por un rato, entrá a la web: las propiedades deberían
   aparecer **rápido** (sin la espera de 30–60 s).
3. En UptimeRobot/cron-job.org el monitor debe figurar **Up / 200** de forma
   continua.

## ¿Y el GitHub Action que ya existía?

`.github/workflows/keep-backend-awake.yml` quedó como **backup manual**:
- Se le **desactivó el schedule automático** porque el cron de GitHub es poco
  fiable (retrasa/saltea ejecuciones) y consumía casi toda la cuota gratuita de
  Actions (2000 min/mes en repo privado).
- Con el pinger externo ya no hace falta. Si alguna vez querés un ping puntual,
  corrélo a mano desde la pestaña **Actions → Keep backend awake → Run workflow**.
- Para volver al ping automático, descomentá el bloque `schedule` en ese archivo.

## Si en el futuro querés cero mantenimiento

Subir el backend al plan **Render Starter (~US$7/mes)** elimina el apagado por
inactividad: nunca hay cold start y no necesitás ningún pinger.
