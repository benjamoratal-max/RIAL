import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

/**
 * Middleware para validar el body de la request con un esquema Zod
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
        }));
        return res.status(400).json({
          error: 'Error de validación',
          details: errors,
        });
      }
      return res.status(500).json({ error: 'Error interno de validación' });
    }
  };
}

/**
 * Middleware para validar los query parameters con un esquema Zod
 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
        }));
        return res.status(400).json({
          error: 'Error de validación en parámetros de consulta',
          details: errors,
        });
      }
      return res.status(500).json({ error: 'Error interno de validación' });
    }
  };
}

/**
 * Middleware para validar los parámetros de ruta con un esquema Zod
 */
export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
        }));
        return res.status(400).json({
          error: 'Error de validación en parámetros de ruta',
          details: errors,
        });
      }
      return res.status(500).json({ error: 'Error interno de validación' });
    }
  };
}

