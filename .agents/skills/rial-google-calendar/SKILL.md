---
name: rial-google-calendar
description: >-
  Integrates Google Calendar with RIAL App so broker property visits (showings)
  are created as Google Calendar events with email invites. Covers OAuth broker
  connection, visit scheduling, env vars, Prisma models, API routes, and
  frontend flows. Use when building, fixing, or extending Google Calendar,
  broker visit scheduling, showings, ScheduleVisit, BrokerCalendarSettings,
  calendar OAuth, or visit sync to Google.
---

# RIAL — Google Calendar para visitas de brokers

## Objetivo

Cuando un **inquilino** agenda una visita a una propiedad, RIAL debe:

1. Guardar el **Showing** en la base de datos.
2. Si el **broker** (owner de la propiedad) tiene Google Calendar conectado, crear un evento en su calendario `primary` con invitaciones al inquilino y al broker.

Zona horaria fija del producto: **`America/New_York`** (Miami-Dade).

## Arquitectura (ya implementada)

```
Broker conecta OAuth          Inquilino agenda visita
        │                              │
        ▼                              ▼
GET /api/calendar/auth/url     POST /api/properties/:id/visits
        │                      (alias: POST /api/calendar/schedule-visit)
        ▼                              │
Google OAuth callback                  ▼
        │                    visitSchedulingService.schedulePropertyVisit()
        ▼                              │
BrokerProfile.googleCalendarRefreshToken
                                       ▼
                             calendarService.createCalendarEvent()
                                       ▼
                             Google Calendar API events.insert
```

## Archivos clave (no reinventar)

| Capa | Archivo | Rol |
|------|---------|-----|
| OAuth + eventos | `real-rentals-ai/src/services/calendarService.ts` | `getAuthUrl`, `exchangeCodeForTokens`, `createCalendarEvent`, `miamiWallClockToDate` |
| Orquestación | `real-rentals-ai/src/services/visitSchedulingService.ts` | Crea `Showing`, llama Calendar si hay refresh token |
| Rutas | `real-rentals-ai/src/routes/calendarRoutes.ts` | `/status`, `/auth/url`, `/auth/google/callback`, `/schedule-visit` |
| Rutas | `real-rentals-ai/src/routes/propertyRoutes.ts` | `POST /:id/visits` → mismo `schedulePropertyVisit` |
| Config | `real-rentals-ai/src/config/env.ts` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |
| Frontend broker | `long-term-rentals/src/components/BrokerCalendarSettings.tsx` | Conectar / reconectar calendario |
| Frontend inquilino | `long-term-rentals/src/components/ScheduleVisit.tsx` | Formulario de visita |
| Perfil broker | `long-term-rentals/src/components/UserProfile.tsx` | Renderiza `BrokerCalendarSettings` |
| OAuth return | `long-term-rentals/src/App.tsx` | Query `?calendar=connected|error` → toast |

## Modelo de datos (Prisma)

**`BrokerProfile`** (`real-rentals-ai/prisma/schema.prisma`):

- `googleCalendarRefreshToken` — refresh token OAuth del broker (secreto, nunca al frontend).
- `googleCalendarConnectedAt` — timestamp de conexión.

**`Showing`**:

- `propertyId`, `brokerId` (= `property.ownerId`), `renterId`, `scheduledAt`, `status`, `visitType`, `notes`
- `googleEventId`, `googleHtmlLink` — se rellenan tras crear el evento.

## API

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/calendar/status` | Broker | `{ configured, connected, connectedAt }` |
| GET | `/api/calendar/auth/url` | Broker | `{ url }` para iniciar OAuth |
| GET | `/api/calendar/auth/google/callback` | Público | Callback OAuth → redirect al frontend |
| POST | `/api/calendar/schedule-visit` | Usuario | Body: `{ propertyId, date, time, visitType?, message? }` |
| POST | `/api/properties/:id/visits` | Usuario | Mismo scheduling (usado por el frontend actual) |

**Body de visita:** `date` = `YYYY-MM-DD`, `time` = `HH:mm`, `visitType` = `in_person` | `video_call`.

**Respuesta relevante:** `googleEventLink`, `calendarConnected` (si el broker no conectó calendario, la visita igual se guarda en RIAL).

## Variables de entorno

En `real-rentals-ai/.env` (ver `.env.example`):

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/calendar/auth/google/callback
FRONTEND_URL=http://localhost:5173
```

En **producción (Render)** el redirect URI debe coincidir **exactamente** con Google Cloud Console, por ejemplo:

`https://rial-zwv8.onrender.com/api/calendar/auth/google/callback`

Scope OAuth usado: `https://www.googleapis.com/auth/calendar.events` (solo eventos, no lectura completa del calendario).

## Configuración Google Cloud (resumen)

1. [Google Cloud Console](https://console.cloud.google.com/) → proyecto → **APIs & Services** → habilitar **Google Calendar API**.
2. **OAuth consent screen** → External (o Internal si es Workspace) → agregar scope `calendar.events`.
3. **Credentials** → OAuth 2.0 Client ID → Web application.
4. **Authorized redirect URIs:** local + Render (ver arriba).
5. Copiar Client ID y Secret a Render / `.env`.

Si el callback devuelve `?calendar=error&reason=no_refresh_token`, el broker debe reconectar con `prompt=consent` (ya está en `getAuthUrl`).

## Flujo broker (frontend)

1. Broker abre **Perfil** → sección **Integraciones** (`BrokerCalendarSettings`).
2. Clic **Conectar Google Calendar** → `GET /api/calendar/auth/url` → redirect a Google.
3. Tras autorizar, vuelve a `/?calendar=connected` → toast en `App.tsx`.

Nav broker tiene tab `calendar` en `RoleNavStrip`; verificar que renderice `BrokerCalendarSettings` si se implementa vista dedicada (hoy el connect está en UserProfile).

## Flujo inquilino (frontend)

1. Desde ficha de propiedad → `ScheduleVisit`.
2. `POST /api/properties/:id/visits` con fecha, hora, tipo, mensaje.
3. Toast según `googleEventLink` / `calendarConnected` (claves i18n en `scheduleVisit.*`).

## Reglas al extender

1. **No duplicar lógica de scheduling** — siempre usar `schedulePropertyVisit` en `visitSchedulingService.ts`.
2. **No exponer** `googleCalendarRefreshToken` al cliente.
3. **OAuth state** — JWT firmado con `purpose: 'google_calendar'` (ver `calendarRoutes.ts`); no cambiar sin migrar callbacks.
4. **Idempotencia / errores Calendar** — si `events.insert` falla, el `Showing` ya existe; se loguea error pero no se revierte la visita (comportamiento actual). Para cancelar/reagendar, actualizar `Showing` y llamar `events.patch` / `events.delete` con `googleEventId`.
5. **Broker = owner** — `brokerId` sale de `property.ownerId`; asegurar que propiedades de broker tengan owner correcto.
6. **i18n** — agregar strings en `long-term-rentals/src/locales/es.json` y `en.json` (`brokerCalendar`, `scheduleVisit`).
7. **CORS / FRONTEND_URL** — el callback redirige al frontend; sin `FRONTEND_URL` cae a `localhost:5173`.

## Gaps habituales (mejoras seguras)

- Vista **Calendario** del nav broker (`brokerNav === 'calendar'`) aún puede no mostrar UI; enlazar a `BrokerCalendarSettings` o listado de `Showing`.
- **Desconectar** calendario (borrar refresh token en `BrokerProfile`).
- **Reagendar / cancelar** → sync con Google vía `googleEventId`.
- **Free/busy** antes de ofrecer slots al inquilino (`calendar.freebusy.query`).
- **Recordatorios / Meet link** para `video_call` (`conferenceData` en `events.insert`).

## Checklist deploy

- [ ] Google Calendar API habilitada
- [ ] Redirect URIs local + producción en Google Cloud
- [ ] `GOOGLE_*` en Render
- [ ] `FRONTEND_URL` = URL Vercel del frontend
- [ ] Broker con rol `broker` / `broker_admin` prueba conectar desde perfil
- [ ] Inquilino agenda visita → evento en Google Calendar del broker + email invite

## Referencia detallada

- Setup Google Cloud paso a paso y payload del evento: [reference.md](reference.md)
