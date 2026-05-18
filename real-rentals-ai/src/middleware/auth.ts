import { Request, Response, NextFunction } from 'express';
import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import config from '../config/env';

export interface AuthRequest extends Request {
  user?: { id: number; role: string };
}

/** Extrae el JWT del header Authorization (tolera espacios, BOM y "Bearer" duplicado). */
export function extractBearerToken(header: string | undefined): string | null {
  if (!header || typeof header !== 'string') return null;
  let h = header.trim();
  if (h.charCodeAt(0) === 0xfeff) h = h.slice(1).trim();
  const match = h.match(/^Bearer\s+(.+)$/i);
  let token = (match ? match[1] : h.startsWith('Bearer ') ? h.slice(7) : h).trim();
  if (/^bearer\s+/i.test(token)) token = token.replace(/^bearer\s+/i, '').trim();
  token = token.replace(/\s+/g, '');
  return token.length > 0 ? token : null;
}

export function auth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: 'No autorizado', code: 'NO_TOKEN' });
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
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return next();
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { id: number; role: string };
    req.user = payload;
  } catch {
    // Ignorar token inválido: la ruta puede seguir en modo anónimo
  }
  next();
}


