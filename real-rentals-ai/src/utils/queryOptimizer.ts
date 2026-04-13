/**
 * Utilidades para optimizar queries de base de datos
 */

import { Prisma } from '@prisma/client';

/**
 * Opciones de select optimizadas para Property
 * Reduce significativamente la cantidad de datos transferidos
 */
export const propertySelectOptimized = {
  id: true,
  title: true,
  description: true,
  location: true,
  price: true,
  bedrooms: true,
  bathrooms: true,
  area: true,
  propertyType: true,
  verified: true,
  createdAt: true,
  ownerId: true,
  images: {
    select: {
      id: true,
      url: true,
    },
  },
} satisfies Prisma.PropertySelect;

/**
 * Opciones de select para Property con relaciones mínimas
 */
export const propertySelectWithOwner = {
  ...propertySelectOptimized,
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.PropertySelect;

/**
 * Opciones de select para Review con usuario
 */
export const reviewSelectWithUser = {
  id: true,
  rating: true,
  comment: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.ReviewSelect;

/**
 * Construir where clause optimizado para búsquedas de propiedades
 */
export function buildPropertyWhere(filters: {
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
  verified?: boolean;
  query?: string;
}): Prisma.PropertyWhereInput {
  const where: Prisma.PropertyWhereInput = {};

  if (filters.location) {
    // SQLite no soporta mode: 'insensitive', usar contains normal
    where.location = { contains: filters.location };
  }

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.price = {};
    if (filters.minPrice !== undefined) {
      where.price.gte = filters.minPrice;
    }
    if (filters.maxPrice !== undefined) {
      where.price.lte = filters.maxPrice;
    }
  }

  if (filters.bedrooms !== undefined) {
    where.bedrooms = filters.bedrooms;
  }

  if (filters.bathrooms !== undefined) {
    where.bathrooms = filters.bathrooms;
  }

  if (filters.propertyType) {
    where.propertyType = filters.propertyType;
  }

  if (filters.verified !== undefined) {
    where.verified = filters.verified;
  }

  // Búsqueda de texto optimizada
  // SQLite no soporta mode: 'insensitive', usar contains normal
  if (filters.query) {
    where.OR = [
      { title: { contains: filters.query } },
      { description: { contains: filters.query } },
      { location: { contains: filters.query } },
    ];
  }

  return where;
}

/**
 * Paginación estándar
 */
export function getPaginationParams(page: number, pageSize: number) {
  const take = Math.max(1, Math.min(100, pageSize)); // Limitar a máximo 100
  const skip = (Math.max(1, page) - 1) * take;
  return { take, skip };
}

