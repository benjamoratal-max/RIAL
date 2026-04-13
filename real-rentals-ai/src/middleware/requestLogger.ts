/**
 * Middleware para logging de peticiones HTTP
 * Registra todas las peticiones con métricas de tiempo
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const { method, path, query, body } = req;
  const userAgent = req.get('user-agent') || 'unknown';
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  // Log de inicio de petición (solo en desarrollo o para rutas importantes)
  if (process.env.NODE_ENV === 'development' || path.startsWith('/api/')) {
    logger.debug(`→ ${method} ${path}`, 'Request', {
      ip,
      userAgent: userAgent.substring(0, 100), // Limitar longitud
      query: Object.keys(query).length > 0 ? query : undefined,
      hasBody: !!body && Object.keys(body).length > 0,
    });
  }

  // Capturar tiempo de respuesta
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { statusCode } = res;

    const metadata = {
      ip,
      statusCode,
      duration,
    };

    // Log según el código de estado
    if (statusCode >= 500) {
      logger.error(`✗ ${method} ${path} ${statusCode} (${duration}ms)`, 'Request', undefined, metadata);
    } else if (statusCode >= 400) {
      logger.warn(`⚠ ${method} ${path} ${statusCode} (${duration}ms)`, 'Request', metadata);
    } else if (process.env.NODE_ENV === 'development' || path.startsWith('/api/')) {
      logger.debug(`✓ ${method} ${path} ${statusCode} (${duration}ms)`, 'Request', metadata);
    }
  });

  next();
}
