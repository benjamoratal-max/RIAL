/**
 * Utilidad centralizada para manejo de errores en el frontend
 * Proporciona mensajes amigables y manejo consistente de errores
 */

export interface AppError {
  message: string;
  code?: string;
  status?: number;
  details?: any;
}

/**
 * Clase personalizada para errores de la aplicación
 */
export class APIError extends Error {
  code?: string;
  status?: number;
  details?: any;

  constructor(message: string, status?: number, code?: string, details?: any) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
    this.details = details;
    (Error as any).captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Convertir error de fetch a APIError
 */
export function handleAPIError(error: any): APIError {
  // Si ya es un APIError, retornarlo
  if (error instanceof APIError) {
    return error;
  }

  // Si es un Error de red
  if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
    return new APIError(
      'No se pudo conectar con el servidor. Verifica tu conexión a internet.',
      0,
      'NETWORK_ERROR'
    );
  }

  // Si tiene información de respuesta
  if (error.response) {
    const { status, data } = error.response;
    return new APIError(
      data?.error || data?.message || 'Error en la solicitud',
      status,
      data?.code,
      data?.details
    );
  }

  // Error genérico
  return new APIError(
    error.message || 'Ocurrió un error inesperado',
    error.status,
    error.code
  );
}

/**
 * Obtener mensaje amigable para el usuario
 */
export function getErrorMessage(error: any): string {
  const apiError = handleAPIError(error);

  // Mensajes personalizados según el código de estado
  switch (apiError.status) {
    case 0:
      return apiError.message || 'No se pudo conectar. Verifica tu conexión a internet y que el servidor esté disponible.';
    case 400:
      return apiError.message || 'Datos inválidos. Por favor verifica la información.';
    case 401:
      return 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.';
    case 403:
      return 'No tienes permiso para realizar esta acción.';
    case 404:
      return 'El recurso solicitado no fue encontrado.';
    case 409:
      return apiError.message || 'El recurso ya existe.';
    case 429:
      return 'Demasiadas peticiones. Por favor espera un momento.';
    case 500:
      return 'Error interno del servidor. Por favor intenta nuevamente más tarde.';
    case 503:
      return 'El servicio no está disponible temporalmente. Por favor intenta más tarde.';
    default:
      return apiError.message || 'Ocurrió un error inesperado.';
  }
}

/**
 * Log de error para debugging (solo en desarrollo)
 */
export function logError(error: any, context?: string): void {
  if (import.meta.env.DEV) {
    console.error(`[Error${context ? ` - ${context}` : ''}]`, {
      message: error.message,
      status: error.status,
      code: error.code,
      details: error.details,
      stack: error.stack,
    });
  }
}

/**
 * Mostrar notificación de error al usuario
 */
export function showErrorNotification(error: any, toast?: any): void {
  const message = getErrorMessage(error);
  
  if (toast) {
    toast.error(message, {
      duration: 5000,
      position: 'top-right',
    });
  } else {
    // Fallback si no hay toast disponible
    alert(message);
  }
}

/**
 * Retry con backoff exponencial
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // No reintentar errores 4xx (errores del cliente)
      if (error.status && error.status >= 400 && error.status < 500) {
        throw error;
      }

      // Esperar antes del siguiente intento
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
