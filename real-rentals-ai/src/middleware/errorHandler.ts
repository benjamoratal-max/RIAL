import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

/**
 * Clase personalizada para errores de la aplicación
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Middleware centralizado para manejo de errores
 * Debe ser el último middleware en la cadena
 */
export function errorHandler(
  err: Error | AppError | ZodError | Prisma.PrismaClientKnownRequestError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Error de validación Zod
  if (err instanceof ZodError) {
    const errors = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    logger.warn('Error de validación', 'ValidationError', {
      path: req.path,
      method: req.method,
      errors,
    });

    return res.status(400).json({
      error: 'Error de validación',
      details: errors,
    });
  }

  // Error de Prisma (base de datos)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.error('Error de base de datos', 'PrismaError', err, {
      code: err.code,
      path: req.path,
      method: req.method,
    });

    // Manejar errores específicos de Prisma
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: 'Conflicto: El recurso ya existe',
        message: 'Ya existe un registro con estos valores únicos',
      });
    }

    if (err.code === 'P2025') {
      return res.status(404).json({
        error: 'Recurso no encontrado',
        message: 'El registro solicitado no existe',
      });
    }

    // Error genérico de Prisma
    return res.status(500).json({
      error: 'Error de base de datos',
      message: process.env.NODE_ENV === 'production' 
        ? 'Ocurrió un error al procesar la solicitud'
        : err.message,
    });
  }

  // Error personalizado de la aplicación
  if (err instanceof AppError) {
    logger.error(err.message, 'AppError', err, {
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
    });

    return res.status(err.statusCode).json({
      error: err.message,
    });
  }

  // Error genérico no manejado
  logger.error('Error no manejado', 'UnhandledError', err as Error, {
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    errorMessage: err.message,
    errorStack: (err as Error).stack,
  });

  const isProduction = process.env.NODE_ENV === 'production';

  return res.status(500).json({
    error: 'Error interno del servidor',
    message: isProduction 
      ? 'Ocurrió un error inesperado. Por favor contacta al soporte.'
      : err.message || 'Ocurrió un error inesperado',
    ...(isProduction ? {} : { 
      stack: (err as Error).stack,
      details: err.message,
      name: (err as Error).name,
      code: (err as any).code,
    }),
  });
}

/**
 * Middleware para capturar rutas no encontradas
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  // Ignorar silenciosamente peticiones comunes del navegador que no son errores reales
  if (req.path === '/favicon.ico' || req.path === '/robots.txt') {
    return res.status(204).end(); // 204 No Content - éxito pero sin contenido
  }
  
  const error = new AppError(`Ruta no encontrada: ${req.method} ${req.path}`, 404);
  next(error);
}

/**
 * Wrapper para manejar errores asíncronos en rutas
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

