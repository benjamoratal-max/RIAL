import { Request, Response, NextFunction } from 'express';
import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import config from '../config/env';

export interface AuthRequest extends Request {
  user?: { id: number; role: string };
}

export function auth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { id: number; role: string };
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      return res.status(401).json({ error: 'Sesión expirada. Vuelve a iniciar sesión.', code: 'TOKEN_EXPIRED' });
    }
    if (err instanceof JsonWebTokenError) {
      return res.status(401).json({ error: 'Token inválido. Cierra sesión y entra de nuevo.', code: 'TOKEN_INVALID' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}

export function requireRole(role: 'owner' | 'tenant' | 'admin') {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    if (req.user.role !== role && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Permisos insuficientes' });
    }
    next();
  };
}

// Alias para compatibilidad con rutas que usan authenticateToken
export const authenticateToken = auth;

/**
 * Si hay Bearer JWT válido, setea req.user; si no hay token o es inválido, continúa sin usuario.
 * Útil para endpoints de solo lectura (p. ej. catálogo público para el asistente).
 */
export function optionalAuthenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next();
  }
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { id: number; role: string };
    req.user = payload;
  } catch {
    // Ignorar token inválido: la ruta puede seguir en modo anónimo
  }
  next();
}


