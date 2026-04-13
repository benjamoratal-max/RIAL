# Brief RIAL — Versión actualizada (producto y diferencial)

Brief alineado con el producto actual para usar como base del business plan. Incluye solo lo implementado y una sección explícita de diferencial y roadmap.

---

## Nombre y tipo de negocio

**RIAL** — PropTech / ReTech para alquileres de mediano y largo plazo, con IA integrada en el flujo, verificación de usuarios y gestión end-to-end (búsqueda → aplicación → firma → pagos).

---

## Resumen

RIAL es una plataforma que unifica en una sola app el ciclo del alquiler de largo plazo: búsqueda de propiedades, agendado de visitas (presencial o videollamada), solicitud de alquiler con documentación y firma digital, y gestión de pagos. La **verificación de cuenta** es obligatoria para iniciar cualquier proceso de alquiler o compra, lo que aumenta confianza y reduce fraude. Tanto inquilinos como propietarios/agentes tienen herramientas propias: los primeros cuentan con un **asistente IA tipo broker** que guía la búsqueda y el proceso; los segundos tienen **precio sugerido por zona**, **screening de riesgo** de solicitantes, **priorización de leads** y **detección de anuncios duplicados**. El objetivo es reducir fricción, acelerar cierres y dar datos útiles a supply y demand.

---

## Qué nos diferencia

- **Flujo real end-to-end en una sola app:** explorar → visitar → aplicar → verificar → firmar → pagar, sin cambiar de canal.
- **Verificación como puerta de entrada:** sin cuenta verificada (email y/o documento) no se puede iniciar alquiler ni compra; la app lo bloquea en UI.
- **IA dentro del flujo, no solo chat:** el broker virtual está integrado en el proceso de alquiler (RentalProcess), guiando pasos y documentación; además, el asistente general hace matching, filtra por preferencias y empuja a agendar visita o aplicar.
- **Lado supply con datos e IA:** precio sugerido y tiempo estimado de colocación al publicar; panel de leads con score de riesgo, banderas rojas y “necesita follow-up”; detección de duplicados al crear propiedad y alertas en el detalle; marcar “respondido” desde leads o al enviar el primer mensaje en chat.
- **Control y seriedad:** registro de administradores solo por aprobación de otro admin; roles claros (inquilino, propietario, admin).
- **Experiencia de búsqueda:** comparador de propiedades (hasta 4), favoritos, alertas, filtros avanzados, recorrido virtual (fotos/video) y política de reserva/seña presente en el contexto del broker para consultas.

---

## Propuesta de valor (producto actual)

### 1) Para inquilinos

**Exploración y decisión**
- Marketplace con fichas completas: precio, depósito, expensas, amenities, ubicación, fotos, video y recorrido virtual.
- Búsqueda por texto, filtros (precio, habitaciones, tipo, amenities) y ordenamiento.
- Comparador de hasta 4 propiedades lado a lado.
- Favoritos y alertas.
- Información normalizada y consistente.

**Visitas**
- Agendar visita desde la app: fecha, franja horaria y tipo (presencial o videollamada).

**Aplicación y precalificación**
- Proceso de alquiler 100% online: datos personales, documentación (DNI, selfie con documento, comprobante de ingresos, estado de cuenta), duración y fecha de inicio.
- Broker virtual integrado en el flujo: guía paso a paso, responde dudas y ayuda con la documentación.
- Firma digital (dibujada o subida de imagen) y aceptación de términos y privacidad.
- Verificación de cuenta (email y/o documento) obligatoria para poder iniciar el proceso; la app no permite “Iniciar alquiler” ni “Quiero comprar” sin estar verificado.

**Cierre**
- Firma digital en-app y envío de la solicitud al propietario.
- Flujo de compra (“Quiero comprar”) disponible además del de alquiler.

**Pagos**
- Panel de pagos: ver historial, estadísticas y registrar/gestar pagos (integración tipo Stripe en diseño).

---

### 2) Para propietarios y agentes

**Publicación**
- Publicación de inmuebles con título, ubicación, precio, fotos, descripción y documentos (opcional).
- **Precio sugerido por zona:** al completar ubicación (y datos opcionales), la app muestra rango de renta sugerido y **tiempo estimado de colocación** en días, con cantidad de propiedades similares en la zona.
- Al publicar, detección automática de **posibles duplicados** (similitud título/descripción); aviso al crear y, para el propietario, **alertas de duplicados** visibles en el detalle de la propiedad.

**Gestión comercial**
- **Panel de leads (solicitudes):** lista de solicitantes por propiedad con estado (pendiente/aprobada/rechazada), **score de riesgo**, **banderas rojas** (ej. cuenta no verificada, email desechable, nombre incompleto) y etiqueta “recomendado responder” para pendientes de hace más de 24 h.
- Acción “Marcar como respondido” por solicitud; también se marca automáticamente cuando el propietario envía el primer mensaje al inquilino en el chat.
- Solicitudes de visita recibidas vía flujo de agendado (backend/notificaciones).

**Analytics**
- Dashboard de analytics para propietarios (métricas por propiedad y visión global).

**Control de acceso**
- Solo usuarios con rol owner o admin pueden publicar y acceder a leads, analytics y alertas de duplicados. Admins: registro solo por aprobación de otro admin.

---

## IA aplicada (implementada)

**Para inquilinos**
- **Asistente Broker (chatbot):** califica necesidad (zona, presupuesto, tipo, amenities), hace matching con propiedades, sugiere siguientes pasos (agendar visita, aplicar), responde con política de reserva/seña y costos, y mantiene tono de broker profesional.
- **Broker dentro del proceso de alquiler:** asistente embebido en el flujo que explica pasos, documentación y firma.
- Soporte multi-idioma (es/en) y respuestas contextuales según preferencias y propiedades disponibles.

**Para propietarios/agentes**
- **Pricing recomendado:** renta sugerida (mín/máx) y tiempo estimado de colocación según ubicación y características.
- **Screening/riesgo:** score numérico y banderas rojas por solicitante (cuenta no verificada, email desechable, etc.) para priorizar y filtrar.
- **Priorización de leads:** orden por “necesita follow-up” y riesgo para no perder oportunidades.
- **Detección de duplicados:** similitud por título/descripción; alertas al publicar y en detalle de propiedad para el dueño.

---

## Trust & Safety (implementado)

- **Verificación de identidad (KYC ligero):** verificación por email (código) y/o por documento (tipo DNI/pasaporte/licencia); estado “verificado” en perfil y bloqueo de inicio de alquiler/compra si no está verificado.
- **Verificación del listing:** propiedades pueden marcarse como verificadas; indicador en fichas.
- **2FA:** disponible en el backend para autenticación (login).
- Depósito y condiciones de contrato visibles en ficha y en el flujo; gestión de disputas y seguros de caución como evolución futura.

---

## Pagos (estado actual)

- Panel de pagos en la app: listado, resumen y creación de pagos (diseño compatible con pasarela tipo Stripe).
- Reglas de negocio definidas para evolución: autopago mensual, recordatorios, reintentos y política de mora (ej. 15 días) como **roadmap**; en el business plan se puede detallar como “en implementación / próxima versión”.

---

## Reserva / seña

- La **política de reserva y seña** está en el contexto del broker (configurable por env) y el asistente la comunica a los usuarios.
- Un flujo explícito in-app de “pagar 50% para bloquear propiedad” está previsto como **roadmap**; para el business plan se puede presentar como “reserva bajo condiciones definidas” hoy y “seña 50% in-app” en siguiente fase.

---

## Inventario

- Propiedades cargadas por **propietarios/agentes** desde la app (formulario de publicación).
- El backend soporta búsqueda, filtros y métricas; integración con más fuentes (bulk, APIs, partnerships) como evolución.

---

## Modelo de negocio (alineado al producto)

**B2C (hoy y próximo paso)**
- Fee de servicio por cierre/gestión (según mercado).
- Futuro: canon por reporte de zona si se implementa; fee por reserva/seña cuando el flujo esté cerrado.

**B2B**
- Licencia SaaS por agente/inmobiliaria (planes por funciones y volumen).
- Publicidad / anuncios destacados (modelo definido; implementación según prioridad).

**Take rate y upsells**
- Take rate sobre transacciones (reserva, gestión de cobro) cuando los flujos estén operativos.
- Upsells: verificación avanzada, seguros/garantías, integraciones (ej. smart locks), gestión contractual.

---

## Beneficios (para el business plan)

- **Producto 360 real:** búsqueda → visita → aplicación → verificación → firma → pagos, todo en la misma plataforma.
- **Menos fricción y más confianza:** verificación obligatoria y datos claros para ambos lados.
- **IA útil para supply y demand:** no solo chatbot, sino broker en el flujo, pricing, riesgo y anti-duplicados.
- **Escalable:** modelo digital, roles y permisos claros, preparado para más mercados con adaptación regulatoria.
- **Datos y analítica:** precios, leads, riesgo y duplicados como ventaja para propietarios y para la plataforma.

---

## Roadmap (resumido para el plan)

- **Corto:** Autopago mensual, recordatorios, reintentos de cobro y política de mora 15 días (automatización de pagos).
- **Medio:** Flujo cerrado de reserva/seña (ej. 50%) in-app para bloquear propiedad.
- **Evolución:** Reporte Premium de zona para inquilinos (comparables, seguridad, servicios); más canales de pago; disputas, seguros de caución y partnerships.

---

## Go-to-market inicial

- Lanzar en una ciudad con alta demanda y fricción (ej. Miami).
- Entrada por supply: inmobiliarias y propietarios con inventario.
- Métricas clave: tiempo de cierre, conversión visita → aplicación → firma, mora, fraude, CAC/LTV.

---

*Este brief refleja el estado actual del producto y el diferencial real para apoyar un business plan creíble y alineado con la app.*
