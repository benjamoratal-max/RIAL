/**
 * Utilidad centralizada para hacer peticiones API
 * Soporta tanto proxy local como URLs públicas (Cloudflare Tunnel, ngrok, etc.)
 */

import { APIError, handleAPIError, logError } from './errorHandler';

/**
 * Base URL del API.
 * - Vacío: rutas relativas `/api/...` (Vite dev proxy, o Vercel rewrites → Render).
 * - Con valor: llamada directa al backend (requiere CORS en Render).
 */
export function getApiBase(): string {
  const raw = (import.meta.env.VITE_API_URL || '').trim();
  if (!raw) return '';
  return raw.replace(/\/$/, '');
}

/** URL absoluta para un path del API (respeta getApiBase). */
export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBase();
  return base ? `${base}${p}` : p;
}

/** Evita `Authorization: Bearer Bearer ...` y caracteres que rompen el JWT (saltos de línea, BOM, espacios). */
export function normalizeBearerToken(token: string): string {
  let t = token.trim();
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1).trim();
  if (/^bearer\s+/i.test(t)) t = t.replace(/^bearer\s+/i, '').trim();
  return t.replace(/\s+/g, '');
}

/** Token de sesión actual (siempre lee localStorage para evitar props desactualizados). */
export function getSessionToken(): string {
  try {
    const raw = localStorage.getItem('token');
    return raw ? normalizeBearerToken(raw) : '';
  } catch {
    return '';
  }
}

export async function api(
  path: string,
  options: { method?: string; token?: string | null; body?: any; retry?: boolean; signal?: AbortSignal } = {}
) {
  const { method = 'GET', token, body, retry = false, signal } = options;
  const makeRequest = async () => {
    try {
      const url = apiUrl(path);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token && String(token).trim()) {
        headers.Authorization = `Bearer ${normalizeBearerToken(String(token))}`;
      }
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal,
      });
      
      if (!res.ok) {
        let errorData: any = {};
        try {
          errorData = await res.json();
        } catch {
          // Si no se puede parsear JSON, crear errorData básico
          errorData = {
            error: res.statusText || `Error ${res.status}`,
            message: res.statusText || `Error ${res.status}`,
          };
        }

        // Crear error con información completa
        const error = new APIError(
          errorData.error || errorData.message || 'Error en la solicitud',
          res.status,
          errorData.code,
          errorData.details
        );

        logError(error, `API ${method} ${path}`);
        throw error;
      }
      
      return res.json();
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw error;
      }
      // Si es un error de red, lanzar un error más descriptivo
      if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        const networkError = new APIError(
          getApiBase()
            ? 'No se pudo conectar con el servidor. Verifica que el backend esté corriendo y accesible.'
            : 'No se pudo conectar con el servidor. Asegúrate de que el backend esté corriendo.',
          0,
          'NETWORK_ERROR'
        );
        logError(networkError, `API ${method} ${path}`);
        throw networkError;
      }
      
      // Si ya es un APIError, solo loguearlo
      if (error instanceof APIError) {
        logError(error, `API ${method} ${path}`);
        throw error;
      }

      // Convertir error genérico
      const apiError = handleAPIError(error);
      logError(apiError, `API ${method} ${path}`);
      throw apiError;
    }
  };

  // Retry automático para errores de red (solo si está habilitado)
  if (retry) {
    const { retryWithBackoff } = await import('./errorHandler');
    return retryWithBackoff(makeRequest, 3, 1000);
  }

  return makeRequest();
}

/**
 * Despierta el backend de Render (plan free se "duerme" tras inactividad).
 * Es fire-and-forget: pega a /health para que el cold start arranque cuanto antes
 * (p. ej. mientras el usuario mira la pantalla de inicio), así el login posterior
 * no tiene que esperar a que el servidor despierte. Nunca lanza errores.
 */
let warmUpInFlight: Promise<void> | null = null;
export function warmUpBackend(): Promise<void> {
  if (warmUpInFlight) return warmUpInFlight;
  warmUpInFlight = (async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);
      try {
        await fetch(apiUrl('/health'), {
          method: 'GET',
          signal: controller.signal,
          // No nos importa la respuesta ni la caché, solo despertar el servidor.
          cache: 'no-store',
        });
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      // Ignorar: si falla, el login/listado hará su propio retry.
    } finally {
      warmUpInFlight = null;
    }
  })();
  return warmUpInFlight;
}

export function authHeaderForToken(token: string | null | undefined): HeadersInit {
  if (!token || !String(token).trim()) return {};
  return { Authorization: `Bearer ${normalizeBearerToken(String(token))}` };
}
