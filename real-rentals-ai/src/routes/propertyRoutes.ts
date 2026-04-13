import express from 'express';
import prisma from '../lib/prisma';
import { auth, AuthRequest } from '../middleware/auth';
import { requireVerification } from '../middleware/requireVerification';
import NotificationService from '../utils/notificationService';
import { validateBody, validateQuery } from '../middleware/validate';
import { createPropertySchema, propertyFiltersSchema, PropertyFiltersInput } from '../validators/property.validator';
import { createLimiter, searchLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';
import { cache, CacheKeys } from '../utils/cache';
import { getSuggestedPricing } from '../services/pricingService';
import { checkDuplicateProperty, saveDuplicateAlerts, getDuplicateAlertsForProperty } from '../services/duplicateDetectionService';
import { syncMiamiRealListings } from '../services/realListingsService';

const router = express.Router();
let lastRealSeedAt = 0;
let seedingInFlight: Promise<any> | null = null;

async function ensureRealMiamiSeed(force = false) {
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  const now = Date.now();
  if (!force && now - lastRealSeedAt < SIX_HOURS) return;
  if (seedingInFlight) {
    await seedingInFlight;
    return;
  }

  seedingInFlight = (async () => {
    try {
      await syncMiamiRealListings(140);
    } finally {
      lastRealSeedAt = Date.now();
      seedingInFlight = null;
    }
  })();
  await seedingInFlight;
}

type StructuredSearch = {
  roomsExact?: number;
  bathroomsExact?: number;
  amenityTerms: string[];
};

function parseStructuredSearch(queryText: string | undefined): StructuredSearch {
  const q = (queryText || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const roomsMatch = q.match(/(\d+)\s*(ambientes?|amb|rooms?)/);
  const bathroomsMatch = q.match(/(\d+)\s*(banos?|bano|baños?|baño|bathrooms?|baths?)/);

  const amenityLexicon: Array<{ canonical: string; terms: string[] }> = [
    { canonical: 'pool', terms: ['pool', 'piscina', 'pileta'] },
    { canonical: 'gym', terms: ['gym', 'gimnasio', 'fitness'] },
    { canonical: 'parking', terms: ['parking', 'estacionamiento', 'cochera', 'garage'] },
    { canonical: 'wifi', terms: ['wifi', 'wi-fi', 'internet'] },
    { canonical: 'air conditioning', terms: ['air conditioning', 'aire acondicionado', 'ac', 'climatizacion'] },
    { canonical: 'heating', terms: ['heating', 'calefaccion'] },
    { canonical: 'balcony', terms: ['balcony', 'balcon'] },
    { canonical: 'elevator', terms: ['elevator', 'ascensor'] },
    { canonical: 'furnished', terms: ['furnished', 'amueblado', 'amoblado'] },
    { canonical: 'pet friendly', terms: ['pet friendly', 'mascotas', 'mascota', 'pet'] },
  ];

  const amenityTerms = amenityLexicon
    .filter(({ terms }) => terms.some((term) => q.includes(term)))
    .map(({ canonical }) => canonical);

  return {
    roomsExact: roomsMatch ? Number(roomsMatch[1]) : undefined,
    bathroomsExact: bathroomsMatch ? Number(bathroomsMatch[1]) : undefined,
    amenityTerms: Array.from(new Set(amenityTerms)),
  };
}

function shouldTryRealSeed(location: any, query: any) {
  const text = `${String(location || '')} ${String(query || '')}`.toLowerCase();
  if (!text.trim()) return true;
  return /miami|fl|florida|331\d{2}/.test(text);
}

router.post('/sync/miami', auth, asyncHandler(async (req: AuthRequest, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Solo admin puede sincronizar listings reales' });
  }
  const result = await syncMiamiRealListings(180);
  lastRealSeedAt = Date.now();
  cache.clear();
  res.json({ ok: true, ...result });
}));

// GET precio sugerido y tiempo estimado de colocación (para propietarios al publicar)
router.get('/suggest-price', asyncHandler(async (req, res) => {
  const { location, propertyType, bedrooms, bathrooms, rooms, area } = req.query as any;
  const result = await getSuggestedPricing({
    location,
    propertyType,
    bedrooms: rooms ? Number(rooms) : (bedrooms ? Number(bedrooms) : undefined),
    bathrooms: bathrooms ? Number(bathrooms) : undefined,
    area: area ? Number(area) : undefined,
  });
  res.json(result);
}));

// GET público (con filtros/orden ya implementados)
router.get('/', searchLimiter, asyncHandler(async (req, res) => {
  // Parsear query sin mutar req.query (en Express 5 puede ser de solo lectura).
  const parsedQuery = propertyFiltersSchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({
      error: 'Error de validación en parámetros de consulta',
      details: parsedQuery.error.issues.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      })),
    });
  }

  const validatedQuery = parsedQuery.data as PropertyFiltersInput;
  const { 
    location, 
    minPrice, 
    maxPrice, 
    sort,
    bedrooms,
    rooms,
    bathrooms,
    amenities,
    propertyType,
    verified,
    query, // Búsqueda semántica por texto
    page = 1,
    pageSize = 12
  } = validatedQuery;

  // Paginación optimizada
  const take = Math.max(1, Math.min(100, Number(pageSize))); // Máximo 100 items por página
  const skip = (Math.max(1, Number(page)) - 1) * take;

  let orderBy: any = undefined;
  if (sort === 'price_asc') orderBy = { price: 'asc' };
  else if (sort === 'price_desc') orderBy = { price: 'desc' };
  else if (sort === 'rating_desc') orderBy = { reviews: { _count: 'desc' } };

  // Registrar búsqueda en background (no bloquea la respuesta)
  const userId = req.headers.authorization ? (req as any).user?.id : null;
  if (userId || query || location) {
    // Ejecutar en background sin await
    setImmediate(async () => {
      try {
        await (prisma as any).propertySearch.create({
          data: {
            userId: userId || null,
            query: query || location || '',
            filters: JSON.stringify({ location, minPrice, maxPrice, bedrooms, rooms, bathrooms, propertyType, amenities }),
            resultsCount: 0,
          },
        });
      } catch (searchError) {
        // Ignorar errores de búsqueda (no crítico)
        logger.debug('Error recording search (non-critical)', 'Property', searchError as Error);
      }
    });
  }

  try {
    if (shouldTryRealSeed(location, query)) {
      const currentCount = await prisma.property.count();
      if (currentCount < 40) {
        await ensureRealMiamiSeed();
      }
    }

    // Crear clave de caché basada en filtros
    const filtersKey = JSON.stringify({ location, minPrice, maxPrice, bedrooms, rooms, bathrooms, amenities, propertyType, verified, query, page, pageSize, sort });
    const cacheKey = CacheKeys.properties(filtersKey);
    
    // Intentar obtener del caché
    const cached = cache.get<any>(cacheKey);
    if (cached) {
      logger.debug('Propiedades obtenidas del caché', 'Property', { filters: validatedQuery });
      return res.json(cached);
    }

    const where: any = {};
    
    if (location) where.location = { contains: location };
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = Number(minPrice);
      if (maxPrice) where.price.lte = Number(maxPrice);
    }
    if (bedrooms) where.bedrooms = Number(bedrooms);
    if (rooms != null) where.rooms = Number(rooms);
    if (bathrooms) where.bathrooms = Number(bathrooms);
    if (propertyType) where.propertyType = propertyType;
    if (verified === true) where.verified = true;

    const structured = parseStructuredSearch(query);
    if (structured.roomsExact != null) where.rooms = structured.roomsExact;
    if (structured.bathroomsExact != null) where.bathrooms = structured.bathroomsExact;

    const amenityFilters = Array.isArray(amenities)
      ? amenities
      : amenities
      ? [amenities]
      : [];
    const requiredAmenities = Array.from(new Set([
      ...amenityFilters.map((a: string) => String(a).toLowerCase()),
      ...structured.amenityTerms,
    ]));
    
    // Búsqueda semántica por texto (título, descripción, ubicación)
    const andClauses: any[] = [];
    if (query) {
      andClauses.push({
        OR: [
        { title: { contains: query } },
        { description: { contains: query } },
        { location: { contains: query } },
        ],
      });
    }

    if (requiredAmenities.length) {
      requiredAmenities.forEach((term) => {
        andClauses.push({
          OR: [
            { title: { contains: term } },
            { description: { contains: term } },
            { location: { contains: term } },
          ],
        });
      });
    }

    if (andClauses.length) {
      where.AND = andClauses;
    }

    // Obtener total para paginación (solo si se necesita)
    const [properties, total] = await Promise.all([
      (prisma.property as any).findMany({
        where,
        orderBy,
        take,
        skip,
        select: {
          id: true,
          title: true,
          description: true,
          location: true,
          price: true,
          bedrooms: true,
          rooms: true,
          bathrooms: true,
          area: true,
          propertyType: true,
          verified: true,
          createdAt: true,
          images: {
            select: {
              url: true,
            },
          },
        },
      }),
      // Solo contar si es la primera página o si se solicita explícitamente
      page === 1 ? prisma.property.count({ where }) : Promise.resolve(0),
    ]);
    
    // Transformar imágenes de objetos a URLs (strings) - ya optimizado con select
    const propertiesWithUrls = properties.map((p: any) => ({
      ...p,
      images: p.images ? p.images.map((img: any) => img.url) : [],
    }));
    
    logger.debug(`Propiedades obtenidas: ${propertiesWithUrls.length}`, 'Property', { filters: where, page, pageSize: take });
    
    // Respuesta con paginación
    const response = {
      items: propertiesWithUrls,
      pagination: {
        page: Number(page),
        pageSize: take,
        total: total || propertiesWithUrls.length, // Si no se contó, usar aproximación
        totalPages: total ? Math.ceil(total / take) : 1,
      },
    };

    // Guardar en caché (2 minutos para búsquedas, 5 minutos para listas sin filtros)
    const cacheTTL = (query || location || minPrice || maxPrice) ? 2 * 60 * 1000 : 5 * 60 * 1000;
    cache.set(cacheKey, response, cacheTTL);

    res.json(response);
  } catch (error) {
    logger.error('Error al obtener propiedades', 'Property', error as Error, { 
      location, minPrice, maxPrice, bedrooms, rooms, bathrooms, amenities, propertyType, verified, query 
    });
    throw error; // Dejar que el error handler lo maneje
  }
}));

// CREATE (protegido): solo brokers verificados pueden publicar
router.post('/', auth, requireVerification, createLimiter, validateBody(createPropertySchema), asyncHandler(async (req: AuthRequest, res) => {
  const { title, description, price, location, images, bedrooms, rooms, bathrooms, ownerId: ownerIdFromBody } = req.body;

  const role = req.user!.role;
  const userId = req.user!.id;

  // Solo brokers verificados (o broker_admin) pueden crear listings en vivo
  const isBroker = role === 'broker' || role === 'broker_admin';
  if (!isBroker) {
    return res.status(403).json({ error: 'Solo cuentas de broker verificadas pueden crear publicaciones. Tu cuenta requiere verificación como broker.' });
  }

  // Comprobar estado de verificación de broker y vigencia de licencia
  // Verificar perfil de broker usando tabla BrokerProfile
  const brokerProfileForUser = await (prisma as any).brokerProfile.findUnique({
    where: { userId },
  });

  if (!brokerProfileForUser || brokerProfileForUser.verificationStatus !== 'approved') {
    return res.status(403).json({ error: 'Solo brokers aprobados pueden publicar. Completa el onboarding y espera la aprobación de tu cuenta.' });
  }

  if (brokerProfileForUser.licenseExpiration && brokerProfileForUser.licenseExpiration < new Date()) {
    return res.status(403).json({ error: 'Tu licencia de broker está vencida. Renueva la licencia para volver a publicar.' });
  }

  const ownerId = userId;

  if (!title || !price || !location) {
    return res.status(400).json({ error: 'title, price y location son obligatorios' });
  }

  try {
    const newProperty = await prisma.property.create({
      data: {
        title,
        description: description ?? '',
        price: Number(price),
        location,
        bedrooms: bedrooms != null && bedrooms !== '' ? Number(bedrooms) : null,
        rooms: rooms != null && rooms !== '' ? Number(rooms) : null,
        bathrooms: bathrooms != null && bathrooms !== '' ? Number(bathrooms) : null,
        // ownerId actúa como brokerId (dueño operativo del listing)
        ...(ownerId ? { ownerId } : {} as any),
        images: Array.isArray(images) && images.length > 0
          ? { create: images.map((url: string) => ({ url })) }
          : undefined,
      },
      include: { images: true, reviews: true, bookings: true },
    });
    
    // Invalidar caché de propiedades
    cache.delete(CacheKeys.property(newProperty.id));
    
    // Notificar a los inquilinos en background (no bloquea la respuesta)
    setImmediate(() => {
      NotificationService.notifyNewProperty(newProperty.id).catch((err) => {
        logger.error('Error notifying new property (non-critical)', 'Property', err as Error);
      });
    });

    let duplicateAlerts: any[] = [];
    try {
      const candidates = await checkDuplicateProperty(newProperty.id);
      if (candidates.length > 0) {
        await saveDuplicateAlerts(newProperty.id, candidates);
        duplicateAlerts = await getDuplicateAlertsForProperty(newProperty.id);
      }
    } catch (e) {
      logger.debug('Duplicate check failed (non-critical)', 'Property', e as Error);
    }

    const propertyWithUrls = {
      ...newProperty,
      images: newProperty.images ? newProperty.images.map((img: any) => img.url) : []
    };

    logger.info(`Propiedad creada: ${newProperty.title}`, 'Property', { propertyId: newProperty.id, ownerId });
    res.status(201).json({ ...propertyWithUrls, duplicateAlerts });
  } catch (error) {
    logger.error('Error al crear propiedad', 'Property', error as Error, { title, ownerId });
    throw error; // Dejar que el error handler lo maneje
  }
}));

// PATCH (protegido): solo el dueño o admin
router.patch('/:id', auth, asyncHandler(async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.id);
  const updates = req.body as Partial<{ title: string; description: string; price: number | string; location: string; images: string[]; bedrooms: number | string; rooms: number | string; bathrooms: number | string }>;

  try {
    const prop = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!prop) return res.status(404).json({ error: 'Propiedad no encontrada' });

    const isAdmin = req.user!.role === 'admin';
    const isOwner = (prop as any).ownerId === req.user!.id;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'No tenés permiso para editar esta propiedad' });
    }

    const allowed: any = {};
    if (updates.title !== undefined) allowed.title = updates.title;
    if (updates.description !== undefined) allowed.description = updates.description;
    if (updates.price !== undefined) allowed.price = Number(updates.price);
    if (updates.location !== undefined) allowed.location = updates.location;
    if (updates.bedrooms !== undefined) allowed.bedrooms = Number(updates.bedrooms);
    if (updates.rooms !== undefined) allowed.rooms = Number(updates.rooms);
    if (updates.bathrooms !== undefined) allowed.bathrooms = Number(updates.bathrooms);

    const updated = await prisma.property.update({
      where: { id: propertyId },
      data: allowed,
      include: { images: true, reviews: true, bookings: true },
    });
    
    // Invalidar caché
    cache.delete(CacheKeys.property(propertyId));
    cache.delete(CacheKeys.propertySummary(propertyId));
    
    // Transformar imágenes de objetos a URLs (strings)
    const updatedWithUrls = {
      ...updated,
      images: updated.images ? updated.images.map((img: any) => img.url) : []
    };
    logger.info(`Propiedad actualizada: ${updated.title}`, 'Property', { propertyId });
    res.json(updatedWithUrls);
  } catch (error) {
    logger.error('Error al actualizar propiedad', 'Property', error as Error, { propertyId });
    throw error;
  }
}));

// DELETE (protegido): solo el dueño o admin
router.delete('/:id', auth, asyncHandler(async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.id);

  try {
    const prop = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!prop) return res.status(404).json({ error: 'Propiedad no encontrada' });

    const isAdmin = req.user!.role === 'admin';
    const isOwner = (prop as any).ownerId === req.user!.id;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'No tenés permiso para borrar esta propiedad' });
    }

    await prisma.property.delete({ where: { id: propertyId } });
    
    // Invalidar caché
    cache.delete(CacheKeys.property(propertyId));
    cache.delete(CacheKeys.propertySummary(propertyId));
    
    logger.info(`Propiedad eliminada`, 'Property', { propertyId });
    res.json({ success: true });
  } catch (error) {
    logger.error('Error al borrar propiedad', 'Property', error as Error, { propertyId });
    throw error;
  }
}));

// Listado con métricas: disponibilidad + promedio y cantidad de reviews + paginación (con caché)
const WITH_METRICS_CACHE_TTL = 2 * 60 * 1000; // 2 minutos

router.get('/with-metrics', asyncHandler(async (req, res) => {
  const { location, minPrice, maxPrice, sort, page = '1', pageSize = '12', query, bedrooms, rooms, bathrooms, amenities, propertyType, verified } = req.query as any;

  if (shouldTryRealSeed(location, query)) {
    const currentCount = await prisma.property.count();
    if (currentCount < 40) {
      await ensureRealMiamiSeed();
    }
  }

  const cacheKey = CacheKeys.properties(JSON.stringify({ location, minPrice, maxPrice, sort, page, pageSize, query, bedrooms, rooms, bathrooms, amenities, propertyType, verified }));
  const cached = cache.get<any>(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  let orderBy: any;
  if (sort === 'price_asc') orderBy = { price: 'asc' };
  else if (sort === 'price_desc') orderBy = { price: 'desc' };

  const where: any = {};
  if (location) where.location = { contains: location };
  if (minPrice != null && minPrice !== '' || maxPrice != null && maxPrice !== '') {
    where.price = {};
    if (minPrice != null && minPrice !== '') where.price.gte = Number(minPrice);
    if (maxPrice != null && maxPrice !== '') where.price.lte = Number(maxPrice);
  }
  if (bedrooms != null && bedrooms !== '') where.bedrooms = Number(bedrooms);
  if (rooms != null) where.rooms = Number(rooms);
  if (bathrooms != null && bathrooms !== '') where.bathrooms = Number(bathrooms);
  if (propertyType) where.propertyType = propertyType;
  if (verified === true || verified === 'true') where.verified = true;

  const structured = parseStructuredSearch(query);
  if (structured.roomsExact != null) where.rooms = structured.roomsExact;
  if (structured.bathroomsExact != null) where.bathrooms = structured.bathroomsExact;

  const amenityFilters = Array.isArray(amenities)
    ? amenities
    : amenities
    ? [amenities]
    : [];
  const requiredAmenities = Array.from(new Set([
    ...amenityFilters.map((a: string) => String(a).toLowerCase()),
    ...structured.amenityTerms,
  ]));

  const andClauses: any[] = [];
  if (query) {
    andClauses.push({
      OR: [
        { title: { contains: query } },
        { description: { contains: query } },
        { location: { contains: query } },
      ],
    });
  }
  if (requiredAmenities.length) {
    requiredAmenities.forEach((term) => {
      andClauses.push({
        OR: [
          { title: { contains: term } },
          { description: { contains: term } },
          { location: { contains: term } },
        ],
      });
    });
  }
  if (andClauses.length) {
    where.AND = andClauses;
  }

  const take = Math.max(1, Math.min(100, Number(pageSize)));
  const skip = (Math.max(1, Number(page)) - 1) * take;

  const [total, properties] = await Promise.all([
    prisma.property.count({ where }),
    (prisma.property as any).findMany({
      where,
      orderBy,
      take,
      skip,
      select: {
        id: true,
        title: true,
        location: true,
        price: true,
        rooms: true,
        bathrooms: true,
        images: true,
      },
    }),
  ]);

  if (properties.length === 0) {
    const empty = { items: [], total: 0, page: Number(page), pageSize: take };
    cache.set(cacheKey, empty, WITH_METRICS_CACHE_TTL);
    return res.json(empty);
  }

  const ids = properties.map((p: any) => p.id);

  const [reviewAgg, occupied, ownership] = await Promise.all([
    prisma.review.groupBy({
      by: ['propertyId'],
      where: { propertyId: { in: ids } },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.leaseRequest.findMany({
      where: { propertyId: { in: ids }, status: 'approved' },
      select: { propertyId: true },
    }),
    (prisma.property as any).findMany({
      where: { id: { in: ids } },
      select: { id: true, ownerId: true },
    }) as Promise<Array<{ id: number; ownerId: number | null }>>,
  ]);

  const avgMap = new Map(reviewAgg.map((r) => [r.propertyId, r._avg.rating ?? 0]));
  const countMap = new Map(reviewAgg.map((r) => [r.propertyId, r._count._all]));
  const occupiedSet = new Set(occupied.map((o) => o.propertyId));

  const ownerIdSet = new Set<number>();
  const propertyIdToOwnerId = new Map<number, number | null>();
  for (const row of ownership) {
    propertyIdToOwnerId.set(row.id, row.ownerId ?? null);
    if (row.ownerId) ownerIdSet.add(row.ownerId);
  }

  const owners = ownerIdSet.size
    ? await prisma.user.findMany({
        where: { id: { in: Array.from(ownerIdSet) } },
        select: { id: true, name: true, role: true },
      })
    : [];
  const ownerMap = new Map(owners.map((u) => [u.id, u]));

  // Traer información de perfil de broker (para badge y datos en el listing)
  const brokerProfiles = ownerIdSet.size
    ? await (prisma as any).brokerProfile.findMany({
        where: { userId: { in: Array.from(ownerIdSet) } },
        select: {
          userId: true,
          brokerageName: true,
          licenseState: true,
          licenseType: true,
          licenseExpiration: true,
          verificationStatus: true,
        },
      })
    : [];
  const brokerProfileMap = new Map(
    brokerProfiles.map((bp: any) => [bp.userId, bp])
  );

  const items = properties.map((p: any) => {
    const ownerId = propertyIdToOwnerId.get(p.id) ?? null;
    const owner = ownerId ? ownerMap.get(ownerId) ?? null : null;
    const brokerProfile = ownerId ? (brokerProfileMap.get(ownerId) as any | null) ?? null : null;
    const imageUrls = Array.isArray(p.images)
      ? p.images.map((img: any) => typeof img === 'string' ? img : img.url)
      : [];
    return {
      property: {
        ...p,
        images: imageUrls,
        owner,
        broker: brokerProfile
          ? {
              name: owner?.name ?? null,
              brokerageName: (brokerProfile as any).brokerageName,
              licenseState: (brokerProfile as any).licenseState,
              licenseType: (brokerProfile as any).licenseType,
              licenseExpiration: (brokerProfile as any).licenseExpiration,
              verificationStatus: (brokerProfile as any).verificationStatus,
              isVerifiedBroker: (brokerProfile as any).verificationStatus === 'approved',
            }
          : owner
          ? {
              name: owner.name,
              brokerageName: null,
              licenseState: null,
              licenseType: null,
              licenseExpiration: null,
              verificationStatus: null,
              isVerifiedBroker: false,
            }
          : null,
      },
      averageRating: avgMap.get(p.id) ?? 0,
      reviewsCount: countMap.get(p.id) ?? 0,
      isAvailable: !occupiedSet.has(p.id),
    };
  });

  const response = { items, total, page: Number(page), pageSize: take };
  cache.set(cacheKey, response, WITH_METRICS_CACHE_TTL);
  res.json(response);
}));

// Alertas de posible duplicado para una propiedad (propietario o admin)
router.get('/:id/duplicate-alerts', auth, asyncHandler(async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.id);
  if (isNaN(propertyId)) return res.status(400).json({ error: 'ID inválido' });
  const prop = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!prop) return res.status(404).json({ error: 'Propiedad no encontrada' });
  const isOwner = (prop as any).ownerId === req.user?.id;
  const isAdmin = req.user?.role === 'admin';
  if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Sin permiso' });
  const alerts = await getDuplicateAlertsForProperty(propertyId);
  res.json({ alerts });
}));

// Resumen de una propiedad: disponibilidad, rating promedio, cantidad y últimas reviews
router.get('/:id/summary', async (req, res) => {
  const propertyId = Number(req.params.id);
  if (isNaN(propertyId)) return res.status(400).json({ error: 'propertyId inválido' });

  // Intentar obtener del caché primero
  const cacheKey = CacheKeys.propertySummary(propertyId);
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    // 1) ¿Está alquilada? (hay LeaseRequest aprobado)
    const approvedLease = await prisma.leaseRequest.findFirst({
      where: { propertyId, status: 'approved' },
      select: { id: true, createdAt: true },
    });
    const isAvailable = !approvedLease;

    // 2) Promedio y conteo de reviews
    const agg = await prisma.review.aggregate({
      where: { propertyId },
      _avg: { rating: true },
      _count: { _all: true },
    });

    // 3) Últimas 3 reviews (con nombre de usuario)
    const latestReviews = await prisma.review.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' } as any,
      take: 3,
      include: { user: { select: { id: true, name: true } } },
    });

    // 4) Datos básicos de la propiedad (para no hacer otra llamada)
    const propertyBase = await (prisma.property as any).findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        title: true,
        location: true,
        price: true,
        images: true,
      },
    });
    if (!propertyBase) return res.status(404).json({ error: 'Propiedad no encontrada' });

    // Registrar vista en background solo si la propiedad existe (evita P2003 por FK)
    const ipAddress = (req.ip || req.headers['x-forwarded-for'] || 'unknown') as string;
    const userAgent = (req.headers['user-agent'] || 'unknown') as string;
    setImmediate(async () => {
      try {
        await (prisma as any).propertyView.create({
          data: {
            propertyId,
            userId: null,
            ipAddress,
            userAgent,
          },
        });
      } catch (viewError) {
        logger.debug('Error recording view (non-critical)', 'Property', viewError as Error);
      }
    });

    let owner: { id: number; name: string } | null = null;
    // Obtener ownerId vía SQL crudo para evitar discrepancias de tipos del cliente
    const rows = await prisma.$queryRaw<{ ownerId: number | null }[]>`SELECT ownerId FROM Property WHERE id = ${propertyId}`;
    const ownerId = rows[0]?.ownerId ?? null;
    if (ownerId) {
      const ownerRow = await prisma.user.findUnique({
        where: { id: ownerId },
        select: { id: true, name: true },
      });
      if (ownerRow) owner = ownerRow;
    }

    // Información de broker para ficha de detalle (si el owner es un broker)
    let broker: any = null;
    if (ownerId) {
      const brokerProfile = await (prisma as any).brokerProfile.findUnique({
        where: { userId: ownerId },
        select: {
          brokerageName: true,
          licenseState: true,
          licenseType: true,
          licenseExpiration: true,
          verificationStatus: true,
        },
      });
      if (brokerProfile) {
        broker = {
          name: owner?.name ?? null,
          brokerageName: brokerProfile.brokerageName,
          licenseState: brokerProfile.licenseState,
          licenseType: brokerProfile.licenseType,
          licenseExpiration: brokerProfile.licenseExpiration,
          verificationStatus: brokerProfile.verificationStatus,
          isVerifiedBroker: brokerProfile.verificationStatus === 'approved',
        };
      }
    }

    // Transformar imágenes de objetos a URLs (strings)
    const imageUrls = Array.isArray(propertyBase.images) 
      ? propertyBase.images.map((img: any) => typeof img === 'string' ? img : img.url)
      : [];
    
    const property = { ...propertyBase, images: imageUrls, owner, broker } as any;

    const result = {
      property,
      isAvailable,
      averageRating: agg._avg.rating ?? 0,
      reviewsCount: agg._count._all,
      latestReviews,
    };

    // Guardar en caché por 2 minutos (datos que cambian frecuentemente)
    cache.set(cacheKey, result, 2 * 60 * 1000);

    return res.json(result);
  } catch {
    return res.status(500).json({ error: 'Error al obtener el resumen de la propiedad' });
  }
});

export default router;
