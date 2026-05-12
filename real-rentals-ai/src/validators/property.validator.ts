import { z } from 'zod';

// Validador para crear propiedad
export const createPropertySchema = z.object({
  title: z.string()
    .min(3, 'El título debe tener al menos 3 caracteres')
    .max(200, 'El título no puede exceder 200 caracteres')
    .trim(),
  description: z.string()
    .max(5000, 'La descripción no puede exceder 5000 caracteres')
    .optional()
    .default(''),
  price: z.number()
    .positive('El precio debe ser un número positivo')
    .max(10000000, 'El precio no puede exceder 10,000,000'),
  location: z.string()
    .min(3, 'La ubicación debe tener al menos 3 caracteres')
    .max(200, 'La ubicación no puede exceder 200 caracteres')
    .trim(),
  latitude: z.number().gte(-90).lte(90).optional(),
  longitude: z.number().gte(-180).lte(180).optional(),
  images: z.array(z.string().url('Cada imagen debe ser una URL válida'))
    .max(20, 'No se pueden agregar más de 20 imágenes')
    .optional()
    .default([]),
  ownerId: z.number().int().positive().optional(),
  bedrooms: z.number().int().min(0).max(50).optional(),
  rooms: z.number().int().min(0).max(50).optional(),
  bathrooms: z.number().int().min(0).max(50).optional(),
  area: z.number().positive().max(100000).optional(),
  propertyType: z.enum(['apartment', 'house', 'studio', 'condo', 'townhouse', 'other']).optional(),
  verified: z.boolean().optional().default(false),
}).refine(
  (data) => {
    const hasLat = data.latitude !== undefined
    const hasLng = data.longitude !== undefined
    return hasLat === hasLng
  },
  { message: 'latitude y longitude deben enviarse juntas', path: ['latitude'] }
);

// Validador para actualizar propiedad
export const updatePropertySchema = createPropertySchema.partial();

// Validador para filtros de búsqueda (query params vienen como strings)
export const propertyFiltersSchema = z.object({
  location: z.string().trim().optional(),
  minPrice: z.union([z.string(), z.number()]).transform((val) => {
    if (typeof val === 'string') {
      const num = parseFloat(val);
      return isNaN(num) ? undefined : num;
    }
    return val;
  }).pipe(z.number().positive().optional()).optional(),
  maxPrice: z.union([z.string(), z.number()]).transform((val) => {
    if (typeof val === 'string') {
      const num = parseFloat(val);
      return isNaN(num) ? undefined : num;
    }
    return val;
  }).pipe(z.number().positive().optional()).optional(),
  bedrooms: z.union([z.string(), z.number()]).transform((val) => {
    if (typeof val === 'string') {
      const num = parseInt(val, 10);
      return isNaN(num) ? undefined : num;
    }
    return val;
  }).pipe(z.number().int().min(0).optional()).optional(),
  bathrooms: z.union([z.string(), z.number()]).transform((val) => {
    if (typeof val === 'string') {
      const num = parseInt(val, 10);
      return isNaN(num) ? undefined : num;
    }
    return val;
  }).pipe(z.number().int().min(0).optional()).optional(),
  rooms: z.union([z.string(), z.number()]).transform((val) => {
    if (typeof val === 'string') {
      const num = parseInt(val, 10);
      return isNaN(num) ? undefined : num;
    }
    return val;
  }).pipe(z.number().int().min(0).optional()).optional(),
  propertyType: z.string().optional(),
  amenities: z.union([z.string(), z.array(z.string())]).transform((val) => {
    if (Array.isArray(val)) return val.filter(Boolean).map((v) => v.trim()).filter(Boolean);
    if (typeof val === 'string' && val.trim()) return [val.trim()];
    return [];
  }).optional(),
  verified: z.union([z.string(), z.boolean()]).transform((val) => {
    if (typeof val === 'string') return val === 'true';
    return val;
  }).optional(),
  query: z.string().trim().optional(),
  sort: z.enum(['price_asc', 'price_desc', 'rating_desc']).optional(),
  page: z.union([z.string(), z.number()]).transform((val) => {
    if (typeof val === 'string') {
      const num = parseInt(val, 10);
      return isNaN(num) ? 1 : num;
    }
    return val || 1;
  }).pipe(z.number().int().min(1)).default(1),
  pageSize: z.union([z.string(), z.number()]).transform((val) => {
    if (typeof val === 'string') {
      const num = parseInt(val, 10);
      return isNaN(num) ? 12 : num;
    }
    return val || 12;
  }).pipe(z.number().int().min(1).max(100)).default(12),
});

// Tipo inferido para TypeScript
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type PropertyFiltersInput = z.infer<typeof propertyFiltersSchema>;

