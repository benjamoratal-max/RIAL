import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { config } from '../config/env';

// En desarrollo, ser más permisivo con los rate limits
const isDevelopment = !config.isProduction;

/**
 * Rate limiter general para todas las rutas
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: isDevelopment ? 1000 : 100, // En desarrollo: 1000 requests, en producción: 100
  message: {
    error: 'Demasiadas peticiones desde esta IP, por favor intenta de nuevo más tarde.',
  },
  standardHeaders: true, // Retorna información de rate limit en headers `RateLimit-*`
  legacyHeaders: false, // Deshabilita headers `X-RateLimit-*`
  skip: (req: Request) => {
    // En desarrollo, permitir más peticiones desde localhost
    if (isDevelopment && (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip?.startsWith('::ffff:127.0.0.1'))) {
      return false; // No saltar el rate limit, pero el max es más alto
    }
    return false;
  },
});

/**
 * Rate limiter estricto para autenticación (login, registro)
 * Previene ataques de fuerza bruta
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: isDevelopment ? 50 : 5, // En desarrollo: 50 intentos, en producción: 5
  message: {
    error: 'Demasiados intentos de autenticación. Por favor intenta de nuevo en 15 minutos.',
  },
  skipSuccessfulRequests: true, // No contar requests exitosos
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter para creación de recursos (propiedades, reviews, etc.)
 * Previene spam y abuso
 */
export const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: isDevelopment ? 100 : 10, // En desarrollo: 100 creaciones, en producción: 10
  message: {
    error: 'Has alcanzado el límite de creación de recursos. Por favor intenta de nuevo más tarde.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter para operaciones de escritura (PATCH, PUT, DELETE)
 */
export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: isDevelopment ? 500 : 30, // En desarrollo: 500 operaciones, en producción: 30
  message: {
    error: 'Demasiadas operaciones de escritura. Por favor intenta de nuevo más tarde.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter para búsquedas y consultas
 * Más permisivo ya que son operaciones de lectura
 */
export const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: isDevelopment ? 200 : 30, // En desarrollo: 200 búsquedas, en producción: 30
  message: {
    error: 'Demasiadas búsquedas. Por favor intenta de nuevo en un momento.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

