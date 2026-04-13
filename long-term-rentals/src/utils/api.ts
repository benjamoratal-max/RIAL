/**
 * Utilidad centralizada para hacer peticiones API
 * Soporta tanto proxy local como URLs públicas (Cloudflare Tunnel, ngrok, etc.)
 */

import { APIError, handleAPIError, logError } from './errorHandler';

const API_BASE = import.meta.env.VITE_API_URL || ''; // Si VITE_API_URL está configurada, usar esa, sino usar proxy de Vite

export async function api(
  path: string,
  options: { method?: string; token?: string | null; body?: any; retry?: boolean } = {}
) {
  const { method = 'GET', token, body, retry = false } = options;
  
  const makeRequest = async () => {
    try {
      const url = `${API_BASE}${path}`;
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
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
      // Si es un error de red, lanzar un error más descriptivo
      if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        const networkError = new APIError(
          API_BASE
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

