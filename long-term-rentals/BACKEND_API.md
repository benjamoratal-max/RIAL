# Endpoints de backend requeridos por la app

La app proxyea todas las peticiones `/api/*` al backend en `VITE_API_HOST:3000` (por defecto `127.0.0.1:3000`).

## Cambios recientes (registro admin y verificación para alquiler)

### 1. Registro de usuarios (`POST /api/auth/register`)

- **Comportamiento esperado**: El frontend ya **no envía** `role: 'admin'`. Solo se permiten `tenant` y `owner`.
- Si el backend recibe `role: 'admin'` (p. ej. desde una versión antigua), debe **rechazarlo** o tratar al usuario como `tenant` hasta que un admin apruebe una solicitud.

### 2. Solicitud de cuenta administrador

- **`POST /api/admin/request`** (sin token)
  - Body: `{ email: string, reason?: string }`
  - Debe crear una solicitud pendiente (tabla `admin_requests` o similar) y devolver éxito.
  - Opcional: enviar email al equipo para notificar.

### 3. Panel de admins: listar y aprobar/rechazar

- **`GET /api/admin/requests`** (con `Authorization: Bearer <token>`)
  - Solo usuarios con `role === 'admin'`.
  - Respuesta: `{ requests: Array<{ id, email, name?, reason?, createdAt, status }> }`.
  - Filtrar por `status === 'pending'` en frontend; el backend puede devolver solo pendientes o todos.

- **`POST /api/admin/requests/:id/approve`** (con token, solo admin)
  - Aprueba la solicitud: crear o actualizar usuario con `role: 'admin'` (si ya existe la cuenta con ese email) o marcar la solicitud para que al registrarse con ese email reciba rol admin tras aprobación).

- **`POST /api/admin/requests/:id/reject`** (con token, solo admin)
  - Marca la solicitud como rechazada.

### 4. Verificación de cuenta (ya existente, debe estar implementada)

- **`GET /api/verification/status`** (con token)
  - Respuesta: `{ verified: boolean, emailVerified?: boolean, documentVerified?: boolean, verifiedAt?: string }`
  - La app **bloquea** "Iniciar proceso de alquiler" y "Quiero comprar" si `verified !== true`.

Asegurarse de que el flujo de verificación (email y/o documento) actualice correctamente este estado para que los usuarios no puedan iniciar un alquiler sin estar verificados.

---

## Búsqueda de propiedades (`GET /api/properties/with-metrics`)

- Parámetros de query: `query`, `location`, `minPrice`, `maxPrice`, `bedrooms`, `bathrooms`, `propertyType`, `sort`, `page`, `pageSize`, `verified`, `amenities[]`, etc.
- **Búsqueda por texto (`query`)**: Para que los usuarios encuentren más fácil, el backend puede (opcional) normalizar y expandir términos: sinónimos (depa/departamento, pileta/piscina, cochera/estacionamiento, monoambiente/estudio, amueblado/amoblado, mascotas/pet), y búsqueda sin acentos. El frontend ya aplica esta lógica en los datos mock cuando el backend no devuelve resultados.

---

## Agendar visita a una propiedad

- **`POST /api/properties/:id/visits`** (con `Authorization: Bearer <token>`)
  - `:id` = ID de la propiedad.
  - Body: `{ date: string (YYYY-MM-DD), time: string (ej. "09:00", "14:00"), visitType?: "in_person" | "video_call", message?: string }`
  - El usuario debe estar autenticado. Crear registro de solicitud de visita (tabla `property_visits` o similar) asociado al usuario y a la propiedad. Notificar al propietario (email o en app) para que confirme o proponga otro horario.
  - Respuesta: `201` con `{ id, propertyId, date, time, visitType, status: "pending" }` o similar. En caso de error (propiedad inexistente, fecha inválida), devolver `4xx` con mensaje.
  - Opcional: **`GET /api/properties/:id/visits`** (con token, propietario de la propiedad o admin) para listar solicitudes de visita; **`PATCH /api/visits/:visitId`** para que el propietario confirme o rechace.

---

## Precio sugerido y tiempo de colocación (propietarios)

- **`GET /api/properties/suggest-price`** (puede ser sin token)
  - Query: `location`, `propertyType`, `bedrooms`, `bathrooms`, `area`.
  - Respuesta: `{ suggestedRentMin, suggestedRentMax, estimatedDaysToPlace, marketAverage?, similarCount }`.
  - Usado en el formulario de crear propiedad para mostrar rango sugerido y días estimados de colocación.

---

## Leads para propietarios (screening y follow-up)

- **`GET /api/analytics/owner/leads`** (con `Authorization: Bearer <token>`, solo owner o admin)
  - Respuesta: `{ leads: Array<{ id, userId, propertyId, status, createdAt, riskScore, redFlags[], needsFollowUp, priorityScore, user: { id, name, email, verified }, property: { id, title } }>, propertyMap }`.
  - Ordenados por prioridad (follow-up pendiente + menor risk score primero).

- **`PATCH /api/leases/:id/responded`** (con token, propietario o admin)
  - Marca la solicitud de alquiler como respondida por el propietario (`ownerRespondedAt`). Usado en el panel de Leads para “Marcar como respondido”.

---

## Alertas de duplicados (propiedades)

- **`GET /api/properties/:id/duplicate-alerts`** (con token, propietario de la propiedad o admin)
  - Respuesta: `{ alerts: Array<{ id, propertyId, suspectedDuplicateOfId, similarityScore, ... }> }`.
  - Opcional: mostrar en detalle/edición de propiedad o en el dashboard del propietario.
