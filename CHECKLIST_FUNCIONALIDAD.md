# Checklist de funcionalidad - RIAL APP

Estado actualizado: 2026-04-09

## 1) Servicios base

- [x] Backend levantado en `http://localhost:3000`
- [x] Frontend levantado en `http://localhost:5173`
- [x] Health backend responde `200` en `/health`
- [x] Frontend responde `200` en `/`

## 2) Configuracion y entorno

- [x] `real-rentals-ai`: `npm run check-config` OK
- [x] Proveedor de IA configurado para Ollama en backend (`AI_PROVIDER=ollama`)
- [x] Proveedor de IA configurado para Ollama en frontend (`VITE_AI_PROVIDER=ollama`)
- [ ] Validar secretos productivos (JWT, SMTP, APIs) antes de deploy

## 3) Base de datos y Prisma

- [x] `npm run db:generate` OK
- [x] `npm run db:push` OK

### Nota operativa Prisma (Windows)

Si vuelve a aparecer `EPERM` al generar Prisma, detener procesos Node activos y reintentar `db:generate`/`db:push`.

## 4) Calidad backend

- [x] `real-rentals-ai`: `npm run build` OK
- [x] `real-rentals-ai`: `npm run test` OK (3 suites, 19 tests)

## 5) Calidad frontend

- [x] `long-term-rentals`: `npm run lint` OK
- [x] `long-term-rentals`: `npm run test` OK (22 tests)
- [x] `long-term-rentals`: `npm run build` OK

### Estado frontend

Resuelto:

- Reglas de hooks (`useEffect` condicional)
- Tipado de `react-google-recaptcha`
- Errores de tipado de utilidades (`responseGenerator`, `learningSystem`, etc.)
- Test de validación de propiedad actualizado al requerimiento actual

## 6) Cierre para "totalmente funcional"

- [x] Resolver errores de lint y TypeScript del frontend
- [x] Correr nuevamente `lint`, `test`, `build` en ambos proyectos
- [x] Confirmar flujo técnico E2E (smoke API):
  - [x] login/registro
  - [x] dashboard (`/api/analytics/owner/dashboard`)
  - [x] leads/properties (`/api/properties/with-metrics`, creación de lead)
  - [x] asistente IA (`/api/ai/generate` y pipeline IA broker)
- [ ] Preparar parametros de produccion:
  - base de datos productiva (no sqlite local)
  - secretos seguros
  - monitoreo/logs

### Estado E2E técnico (2026-04-09)

- `GET /api/properties` corregido: ahora responde `200`.
- Smoke E2E técnico completo en verde:
  - properties list `200`
  - tenant register/login `201/200`
  - AI generate `200`
  - owner dashboard `200`
  - lead create `201`
  - broker applicant -> admin activate -> broker pipeline/AI `200`
