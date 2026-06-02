# Tests E2E (Playwright)

Tests end-to-end que prueban los flujos clave de RIAL App manejando el navegador
como un usuario real.

## Arquitectura

Los tests corren contra el **frontend real** (Vite dev server) pero **interceptan
todas las llamadas a `/api/**`** y devuelven respuestas simuladas
(`e2e/support/mockApi.ts` + `e2e/support/fixtures.ts`).

Ventajas:
- No requieren backend, base de datos ni servicios externos (email, SMS, pagos, OCR).
- Son rápidos y determinísticos.
- Funcionan igual en esta máquina y en CI.

## Cómo correrlos

```bash
# Desde long-term-rentals/
npm run test:e2e            # corre toda la suite (headless)
npm run test:e2e:ui         # modo interactivo con UI de Playwright
npm run test:e2e:report     # abre el último reporte HTML
```

Playwright levanta el dev server automáticamente (`npm run dev`).

## Qué cubre

| Archivo | Flujo |
|---------|-------|
| `smoke.spec.ts` | Carga de la app, listado de propiedades, panel de auth, cambio de idioma |
| `properties.spec.ts` | Abrir/cerrar detalle de propiedad, vista de mapa |
| `auth.spec.ts` | Registro (con auto-login), login, validación de credenciales |
| `visit-rent.spec.ts` | Agendar visita, iniciar proceso de alquiler (usuario verificado) |

## Agregar un test

1. Importá `mockApi` (y `seedLoggedInSession` si necesitás sesión iniciada).
2. Configurá las respuestas necesarias en `fixtures.ts` / `mockApi.ts`.
3. Escribí el spec usando selectores por rol/texto visible (en español, idioma por defecto).
