/**
 * Sistema de caché simple en memoria para optimizar queries frecuentes
 * TTL (Time To Live) configurable por tipo de dato
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class SimpleCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly defaultTTL: number = 5 * 60 * 1000; // 5 minutos por defecto

  /**
   * Obtener valor del caché
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Verificar si expiró
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Guardar valor en caché
   */
  set<T>(key: string, data: T, ttlMs?: number): void {
    const ttl = ttlMs || this.defaultTTL;
    const expiresAt = Date.now() + ttl;
    
    this.cache.set(key, {
      data,
      expiresAt,
    });
  }

  /**
   * Eliminar valor del caché
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /** Elimina todas las claves que empiezan con un prefijo (p. ej. `properties:`). */
  deleteByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Limpiar todo el caché
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Limpiar entradas expiradas
   */
  cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Obtener o calcular (patrón cache-aside)
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetcher();
    this.set(key, data, ttlMs);
    return data;
  }
}

// Instancia singleton
export const cache = new SimpleCache();

// Limpiar entradas expiradas cada 10 minutos
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cache.cleanExpired();
  }, 10 * 60 * 1000);
}

// Claves de caché comunes
export const CacheKeys = {
  properties: (filters: string) => `properties:${filters}`,
  property: (id: number) => `property:${id}`,
  propertySummary: (id: number) => `property:summary:${id}`,
  user: (id: number) => `user:${id}`,
  reviews: (propertyId: number) => `reviews:${propertyId}`,
} as const;
