/**
 * Servicio de pricing recomendado para propietarios: renta sugerida y tiempo estimado de colocación.
 */
import prisma from '../lib/prisma';

const DEFAULT_DAYS_PER_1000 = 45; // días promedio por cada 1000 USD de diferencia vs media

export interface SuggestedPricing {
  suggestedRentMin: number;
  suggestedRentMax: number;
  estimatedDaysToPlace: number;
  marketAverage: number;
  similarCount: number;
}

export async function getSuggestedPricing(params: {
  location?: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  area?: number;
}): Promise<SuggestedPricing> {
  const where: any = { available: true };
  if (params.location) where.location = { contains: params.location };
  if (params.propertyType) where.propertyType = params.propertyType;
  if (params.bedrooms != null) where.bedrooms = params.bedrooms;
  if (params.bathrooms != null) where.bathrooms = params.bathrooms;
  if (params.area != null) where.area = { gte: params.area * 0.8, lte: params.area * 1.2 };

  const similar = await prisma.property.findMany({
    where,
    select: { price: true },
    take: 100,
  });

  if (similar.length === 0) {
    const fallback = await prisma.property.findMany({
      where: { available: true },
      select: { price: true },
      take: 50,
    });
    const avg = fallback.length ? fallback.reduce((s, p) => s + p.price, 0) / fallback.length : 800;
    const min = avg * 0.85;
    const max = avg * 1.15;
    const days = Math.max(14, Math.min(90, 60 + (avg - 500) / 100));
    return {
      suggestedRentMin: Math.round(min),
      suggestedRentMax: Math.round(max),
      estimatedDaysToPlace: Math.round(days),
      marketAverage: Math.round(avg),
      similarCount: 0,
    };
  }

  const prices = similar.map((p) => p.price);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const std = Math.sqrt(prices.reduce((s, p) => s + (p - avg) ** 2, 0) / prices.length) || avg * 0.1;
  const suggestedRentMin = Math.round(Math.max(0, avg - std));
  const suggestedRentMax = Math.round(avg + std);
  const marketAverage = Math.round(avg);
  const estimatedDaysToPlace = Math.max(
    14,
    Math.min(120, 30 + (avg / 500) * 15 + (similar.length < 5 ? 20 : 0))
  );

  return {
    suggestedRentMin,
    suggestedRentMax,
    estimatedDaysToPlace,
    marketAverage,
    similarCount: similar.length,
  };
}
