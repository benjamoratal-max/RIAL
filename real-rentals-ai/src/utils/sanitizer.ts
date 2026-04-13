/**
 * Utilidades para sanitizar y validar datos de entrada
 * Previene XSS, SQL injection, y otros ataques
 */

/**
 * Sanitizar string (remover caracteres peligrosos)
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .replace(/[<>]/g, '') // Remover < y >
    .replace(/javascript:/gi, '') // Remover javascript:
    .replace(/on\w+=/gi, '') // Remover event handlers (onclick=, etc.)
    .substring(0, 10000); // Limitar longitud
}

/**
 * Sanitizar email
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') {
    return '';
  }

  return email
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9@._-]/g, '') // Solo permitir caracteres válidos
    .substring(0, 255);
}

/**
 * Sanitizar número (asegurar que sea un número válido)
 */
export function sanitizeNumber(input: any, min?: number, max?: number): number | null {
  const num = typeof input === 'number' ? input : parseFloat(String(input));
  
  if (isNaN(num)) {
    return null;
  }

  if (min !== undefined && num < min) {
    return min;
  }

  if (max !== undefined && num > max) {
    return max;
  }

  return num;
}

/**
 * Sanitizar objeto (sanitizar todas las propiedades string)
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized: any = { ...obj };

  for (const key in sanitized) {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = sanitizeString(sanitized[key]);
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null && !Array.isArray(sanitized[key])) {
      sanitized[key] = sanitizeObject(sanitized[key]);
    } else if (Array.isArray(sanitized[key])) {
      sanitized[key] = sanitized[key].map((item: any) => 
        typeof item === 'string' ? sanitizeString(item) : item
      );
    }
  }

  return sanitized as T;
}

/**
 * Validar y sanitizar URL
 */
export function sanitizeUrl(url: string): string | null {
  if (typeof url !== 'string') {
    return null;
  }

  try {
    const parsed = new URL(url);
    // Solo permitir http y https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Validar que un string no contenga código peligroso
 */
export function isSafeString(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /eval\s*\(/i,
    /expression\s*\(/i,
    /vbscript:/i,
    /data:text\/html/i,
  ];

  return !dangerousPatterns.some(pattern => pattern.test(input));
}
