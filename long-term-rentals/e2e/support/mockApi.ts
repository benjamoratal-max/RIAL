import { Page, Route, Request } from '@playwright/test'
import {
  propertiesList,
  summaryResponseFor,
  makeUser,
  FAKE_TOKEN,
} from './fixtures'

type MockOptions = {
  /** Usuario simulado a devolver en login/registro. Si es null, los flujos auth no se preconfiguran. */
  user?: ReturnType<typeof makeUser> | null
  /** Estado de verificación de identidad (habilita alquilar/comprar). */
  verified?: boolean
  /** Capturas de requests para aserciones (POST visitas, reviews, etc.). */
  onRequest?: (info: { method: string; url: string; postData: any }) => void
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

function parseBody(request: Request): any {
  try {
    return request.postDataJSON()
  } catch {
    return undefined
  }
}

/**
 * Intercepta TODAS las llamadas a /api/** y responde con datos simulados.
 * Cubre los endpoints que la app dispara al cargar y en los flujos clave.
 * Cualquier endpoint no contemplado cae en un fallback que evita que el test
 * se cuelgue (devuelve {} o lista vacía según el método).
 */
export async function mockApi(page: Page, opts: MockOptions = {}) {
  const user = opts.user ?? makeUser()
  const verified = opts.verified ?? true

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const method = request.method()
    const url = new URL(request.url())
    const path = url.pathname.replace(/\/+$/, '')
    const body = parseBody(request)

    opts.onRequest?.({ method, url: path, postData: body })

    // --- Autenticación ---
    if (path.endsWith('/api/auth/register') && method === 'POST') {
      return json(route, { id: user.id, name: body?.name, email: body?.email, role: body?.role || 'tenant', emailVerified: false }, 201)
    }
    if (path.endsWith('/api/auth/login') && method === 'POST') {
      return json(route, { token: FAKE_TOKEN, user: { ...user, email: body?.email ?? user.email } })
    }

    // --- Perfil / validación de sesión ---
    if (/\/api\/users\/\d+$/.test(path) && method === 'GET') {
      return json(route, makeUser({ verified, emailVerified: true }))
    }
    if (path.endsWith('/api/brokers/me')) {
      return json(route, { profile: { verificationStatus: 'approved', brokerageName: 'RIAL Realty' } })
    }

    // --- Contadores (header) ---
    if (path.endsWith('/unread-count')) {
      return json(route, { count: 0 })
    }

    // --- Verificación de identidad ---
    if (path.endsWith('/api/verification/status')) {
      return json(route, { verified, emailVerified: true, documentStatus: verified ? 'verified' : 'none' })
    }

    // --- Listado de propiedades ---
    if (path.endsWith('/api/properties/with-metrics') && method === 'GET') {
      return json(route, { items: propertiesList, total: propertiesList.length, page: 1, pageSize: 12 })
    }
    if (path.endsWith('/api/ai/property-catalog')) {
      return json(route, { items: propertiesList.map((p) => p.property), total: propertiesList.length, totalPages: 1 })
    }

    // --- Resumen / detalle de propiedad ---
    const summaryMatch = path.match(/\/api\/properties\/(\d+)\/summary$/)
    if (summaryMatch && method === 'GET') {
      return json(route, summaryResponseFor(Number(summaryMatch[1])))
    }
    if (/\/api\/properties\/\d+\/duplicate-alerts$/.test(path)) {
      return json(route, { alerts: [] })
    }

    // --- Agendar visita ---
    if (/\/api\/properties\/\d+\/visits$/.test(path) && method === 'POST') {
      return json(route, { id: 999, status: 'pending', date: body?.date, time: body?.time }, 201)
    }

    // --- Reviews ---
    if (path.endsWith('/api/reviews') && method === 'POST') {
      return json(route, { id: 555, rating: body?.rating, comment: body?.comment }, 201)
    }

    // --- Fallback: nunca dejar un request colgado ---
    if (method === 'GET') {
      // Heurística: rutas de "listas" devuelven array vacío, el resto objeto vacío.
      if (/(list|all|requests|leads|notifications|messages|alerts|slots|availability)/i.test(path)) {
        return json(route, { items: [], data: [], total: 0 })
      }
      return json(route, {})
    }
    return json(route, { ok: true }, 200)
  })
}

/** Inyecta una sesión ya iniciada (token + user) en localStorage antes de cargar la app. */
export async function seedLoggedInSession(page: Page, user = makeUser()) {
  await page.addInitScript(
    ([token, u]) => {
      localStorage.setItem('token', token as string)
      localStorage.setItem('user', JSON.stringify(u))
    },
    [FAKE_TOKEN, user] as const
  )
}
