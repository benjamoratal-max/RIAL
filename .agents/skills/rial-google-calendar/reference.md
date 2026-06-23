# Google Calendar — referencia RIAL

## Payload del evento (`calendarService.createCalendarEvent`)

```typescript
{
  summary: `Visita: ${propertyTitle}`,
  location: visitType === 'video_call' ? 'Videollamada — RIAL (Miami-Dade)' : propertyAddress,
  description: 'Visita agendada desde RIAL.\nInquilino: ...\nBroker: ...',
  start: { dateTime: 'YYYY-MM-DDTHH:mm:00', timeZone: 'America/New_York' },
  end:   { dateTime: 'YYYY-MM-DDTHH:mm:00', timeZone: 'America/New_York' }, // +1h vía addOneHour
  attendees: [{ email: tenantEmail }, { email: brokerEmail }],
  reminders: {
    useDefault: false,
    overrides: [
      { method: 'email', minutes: 1440 },
      { method: 'popup', minutes: 30 },
    ],
  },
}
```

`events.insert({ calendarId: 'primary', sendUpdates: 'all' })` — Google envía invitaciones por correo.

## OAuth callback — errores en query string

| `reason` | Causa |
|----------|--------|
| `denied` | Usuario canceló en Google |
| `missing_params` | Falta `code` o `state` |
| `invalid_state` | JWT state expirado o inválido |
| `not_configured` | Faltan env vars en servidor |
| `no_refresh_token` | Reconectar; Google no devolvió refresh (revocar app en cuenta Google y repetir) |
| `exchange_failed` | Error al intercambiar code por tokens |

## Google Cloud — redirect URIs autorizadas

Desarrollo:

```
http://localhost:3000/api/calendar/auth/google/callback
```

Producción (ajustar si cambia el servicio Render):

```
https://rial-zwv8.onrender.com/api/calendar/auth/google/callback
```

## Extender: cancelar visita en Google

```typescript
// Pseudocódigo — usar refresh token del broker en BrokerProfile
await calendar.events.delete({
  calendarId: 'primary',
  eventId: showing.googleEventId,
  sendUpdates: 'all',
});
await prisma.showing.update({
  where: { id: showing.id },
  data: { status: 'cancelled' },
});
```

## Extender: Google Meet para videollamadas

En `events.insert`, agregar `conferenceData` y `conferenceDataVersion: 1` (requiere scope adecuado o configuración de Meet en el proyecto Google). Probar en sandbox antes de producción.

## Dependencia

Backend: `googleapis` (ya en `real-rentals-ai/package.json`).

## Tests manuales

1. `GET /api/calendar/status` con JWT de broker → `configured: true` si hay env vars.
2. Conectar calendario desde UI → `connected: true`.
3. `POST /api/properties/{id}/visits` como inquilino con fecha futura → `googleEventLink` presente si broker conectado.
4. Verificar fila en `Showing` con `googleEventId` y evento en calendar.google.com del broker.
