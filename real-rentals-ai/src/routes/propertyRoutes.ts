import express from 'express';
import prisma from '../lib/prisma';
import { auth, AuthRequest } from '../middleware/auth';
import NotificationService from '../utils/notificationService';
import { validateBody, validateQuery } from '../middleware/validate';
import { createPropertySchema, propertyFiltersSchema, PropertyFiltersInput } from '../validators/property.validator';
import { rentalMonthsToString } from '../utils/rentalMonths';
import { createLimiter, searchLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';
import { cache, CacheKeys } from '../utils/cache';
import { getSuggestedPricing } from '../services/pricingService';
import { checkDuplicateProperty, saveDuplicateAlerts, getDuplicateAlertsForProperty } from '../services/duplicateDetectionService';
import { verifyListingForPublish } from '../services/listingVerificationService';
import { enrichMiamiListingsFromRentcast, enrichMiamiListingsWithAIGeneratedPhotos, enrichMiamiListingsWithStreetView, resetMiamiListingsPhotosWithAIGenerated, syncMiamiRealListings } from '../services/realListingsService';
import { parsePropertySearchQuery } from '../utils/searchQueryParser';
import { schedulePropertyVisit } from '../services/visitSchedulingService';

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

async function ensureRealMiamiSeedSafe(force = false) {
  try {
    await ensureRealMiamiSeed(force);
  } catch (error) {
    // No bloquear el listado público si falla el proveedor externo o la inserción.
    logger.warn('No se pudo sincronizar Miami en background; se continúa con datos existentes', 'Property', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function shouldTryRealSeed(location: any, query: any) {
  const text = `${String(location || '')} ${String(query || '')}`.toLowerCase();
  if (!text.trim()) return true;
  return /miami|fl|florida|331\d{2}/.test(text);
}

function extractLocationParts(location?: string | null) {
  const parts = String(location || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const city = parts.length >= 2 ? parts[1] : 'Miami';
  const stateOrCountry = parts.length >= 3 ? parts[2] : 'FL';
  return { city, stateOrCountry };
}

function buildAmenityHints(text?: string | null) {
  const source = String(text || '').toLowerCase();
  const has = (term: string) => source.includes(term);
  const amenities: string[] = [];
  if (has('pool') || has('piscina')) amenities.push('Pool');
  if (has('gym') || has('gimnasio')) amenities.push('Gym');
  if (has('parking') || has('garage') || has('cochera')) amenities.push('Parking');
  if (has('balcony') || has('balcon')) amenities.push('Balcony');
  if (has('elevator') || has('ascensor')) amenities.push('Elevator');
  if (has('air conditioning') || has('aire acondicionado')) amenities.push('Air conditioning');
  if (has('pet friendly') || has('mascota')) amenities.push('Pet friendly');
  return amenities;
}

function normalizePropertyType(rawType?: string | null) {
  const value = String(rawType || '').toLowerCase().trim();
  if (!value) return 'apartment';

  const houseTokens = ['house', 'single family', 'single_family', 'villa', 'townhouse', 'duplex', 'home'];
  if (houseTokens.some((token) => value.includes(token))) return 'house';

  const apartmentTokens = ['apartment', 'apt', 'condo', 'condominium', 'studio', 'loft', 'unit'];
  if (apartmentTokens.some((token) => value.includes(token))) return 'apartment';

  return value;
}

function orderImagesForReliability(urls: string[]): string[] {
  const unique = Array.from(new Set((urls || []).map((u) => String(u || '').trim()).filter(Boolean)));
  const nonAi = unique.filter((u) => !u.includes('image.pollinations.ai/prompt/'));
  const ai = unique.filter((u) => u.includes('image.pollinations.ai/prompt/'));
  return [...nonAi, ...ai];
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

router.post('/sync/miami/enrich', auth, asyncHandler(async (req: AuthRequest, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Solo admin puede enriquecer listings reales' });
  }
  const result = await enrichMiamiListingsFromRentcast(400);
  cache.clear();
  res.json({ ok: true, ...result });
}));

router.post('/sync/miami/photos/streetview', auth, asyncHandler(async (req: AuthRequest, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Solo admin puede enriquecer fotos' });
  }
  const result = await enrichMiamiListingsWithStreetView(400);
  cache.clear();
  res.json({ ok: true, ...result });
}));

router.post('/sync/miami/photos/ai', auth, asyncHandler(async (req: AuthRequest, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Solo admin puede enriquecer fotos IA' });
  }
  const result = await enrichMiamiListingsWithAIGeneratedPhotos(500);
  cache.clear();
  res.json({ ok: true, ...result });
}));

router.post('/sync/miami/photos/ai/reset', auth, asyncHandler(async (req: AuthRequest, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Solo admin puede resetear fotos IA' });
  }
  const result = await resetMiamiListingsPhotosWithAIGenerated(600);
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
        // No bloquear el listado: la sync de Miami puede tardar minutos; el usuario ve datos actuales al instante.
        void ensureRealMiamiSeedSafe();
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
    if (bedrooms != null) where.bedrooms = Number(bedrooms);
    if (rooms != null) where.rooms = Number(rooms);
    if (bathrooms != null) where.bathrooms = Number(bathrooms);
    if (propertyType) where.propertyType = propertyType;
    if (verified === true) where.verified = true;

    const parsed = parsePropertySearchQuery(query);
    if (rooms == null && parsed.roomsExact != null) where.rooms = parsed.roomsExact;
    if (bedrooms == null && parsed.bedroomsExact != null) where.bedrooms = parsed.bedroomsExact;
    if (bathrooms == null && parsed.bathroomsExact != null) where.bathrooms = parsed.bathroomsExact;

    const amenityFilters = Array.isArray(amenities)
      ? amenities
      : amenities
      ? [amenities]
      : [];
    const requiredAmenities = Array.from(new Set([
      ...amenityFilters.map((a: string) => String(a).toLowerCase()),
      ...parsed.amenityTerms.map((a) => a.toLowerCase()),
    ]));
    
    // Texto libre: cada token debe aparecer en título, descripción o ubicación (AND).
    const andClauses: any[] = [];
    if (query && parsed.textTokens.length > 0) {
      for (const token of parsed.textTokens) {
        andClauses.push({
          OR: [
            { title: { contains: token } },
            { description: { contains: token } },
            { location: { contains: token } },
          ],
        });
      }
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
          latitude: true,
          longitude: true,
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
    // Truncar descripción a 240 chars en listados (la completa se trae en el endpoint de detalle)
    // -> reduce el payload del listado típicamente en 50-70%, acelerando la primera pintura.
    const propertiesWithUrls = properties.map((p: any) => ({
      ...p,
      description: typeof p.description === 'string' && p.description.length > 240
        ? p.description.slice(0, 237) + '...'
        : p.description,
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

    // HTTP cache headers: el browser y los CDNs (Render, Cloudflare) reutilizan la respuesta
    // sin pegarle al backend mientras el TTL no expire. ENORME ganancia en navegación repetida.
    // s-maxage permite a CDNs cachear aunque el usuario tenga un token (no es info privada).
    const cacheSeconds = Math.floor(cacheTTL / 1000);
    res.setHeader('Cache-Control', `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}, stale-while-revalidate=60`);

    res.json(response);
  } catch (error) {
    logger.error('Error al obtener propiedades', 'Property', error as Error, { 
      location, minPrice, maxPrice, bedrooms, rooms, bathrooms, amenities, propertyType, verified, query 
    });
    throw error; // Dejar que el error handler lo maneje
  }
}));

// CREATE (protegido): solo brokers verificados pueden publicar
router.post('/', auth, createLimiter, validateBody(createPropertySchema), asyncHandler(async (req: AuthRequest, res) => {
  const {
    title,
    description,
    price,
    location,
    city,
    neighborhood,
    expensesIncluded,
    images,
    bedrooms,
    rooms,
    bathrooms,
    area,
    latitude,
    longitude,
    rentalMonths,
    videoTourUrl,
    ownerDniDocumentUrl,
    contractOrTitleUrl,
  } = req.body;

  const role = req.user!.role;
  const userId = req.user!.id;

  const canPublishListing = role === 'broker' || role === 'broker_admin' || role === 'admin';
  if (!canPublishListing) {
    return res.status(403).json({
      error: 'Solo brokers aprobados o administradores pueden crear publicaciones.',
    });
  }

  if (role !== 'admin') {
    const brokerProfileForUser = await (prisma as any).brokerProfile.findUnique({
      where: { userId },
    });

    if (!brokerProfileForUser || brokerProfileForUser.verificationStatus !== 'approved') {
      return res.status(403).json({
        error: 'Solo brokers aprobados pueden publicar. Completa el onboarding y espera la aprobación de tu cuenta.',
      });
    }

    if (brokerProfileForUser.licenseExpiration && brokerProfileForUser.licenseExpiration < new Date()) {
      return res.status(403).json({
        error: 'Tu licencia de broker está vencida. Renueva la licencia para volver a publicar.',
      });
    }
  }

  const ownerId = userId;

  if (!title || !price || !location || !city || !neighborhood) {
    return res.status(400).json({ error: 'title, price, location, city y neighborhood son obligatorios' });
  }

  if (!ownerDniDocumentUrl || !contractOrTitleUrl || !videoTourUrl) {
    return res.status(400).json({
      error: 'DNI del propietario, contrato/título y video tour son obligatorios para publicar.',
    });
  }

  if (!Array.isArray(images) || images.length < 8) {
    return res.status(400).json({ error: 'Se requieren al menos 8 fotos de la propiedad.' });
  }

  const verification = await verifyListingForPublish({
    images,
    ownerDniDocumentUrl,
    contractOrTitleUrl,
    videoTourUrl,
    latitude,
    longitude,
    location,
  });

  if (!verification.verified) {
    return res.status(422).json({
      error: 'La publicación no pasó la verificación automática. Revisá fotos y documentos.',
      code: 'LISTING_VERIFICATION_FAILED',
      verification,
      details: verification.failures.map((message) => ({ path: 'listing', message })),
    });
  }

  try {
    const newProperty = await prisma.property.create({
      data: {
        title,
        description: `${description ?? ''}${description ? '\n\n' : ''}Expensas incluidas: ${expensesIncluded ? 'Sí' : 'No'}`,
        price: Number(price),
        location: `${neighborhood}, ${city}, ${location}`,
        bedrooms: bedrooms != null && bedrooms !== '' ? Number(bedrooms) : null,
        rooms: rooms != null && rooms !== '' ? Number(rooms) : null,
        bathrooms: bathrooms != null && bathrooms !== '' ? Number(bathrooms) : null,
        area: area != null && area !== '' ? Number(area) : null,
        latitude: typeof latitude === 'number' && Number.isFinite(latitude) ? latitude : null,
        longitude: typeof longitude === 'number' && Number.isFinite(longitude) ? longitude : null,
        rentalMonths: rentalMonthsToString(rentalMonths),
        videoTourUrl: videoTourUrl ?? null,
        ownerDniDocumentUrl: ownerDniDocumentUrl ?? null,
        contractOrTitleUrl: contractOrTitleUrl ?? null,
        verified: true,
        // ownerId actúa como brokerId (dueño operativo del listing)
        ...(ownerId ? { ownerId } : {} as any),
        images: Array.isArray(images) && images.length > 0
          ? { create: images.map((url: string) => ({ url })) }
          : undefined,
      },
      include: { images: true },
    });
    
    cache.delete(CacheKeys.property(newProperty.id));
    cache.deleteByPrefix('properties:');
    
    setImmediate(() => {
      NotificationService.notifyNewProperty(newProperty.id).catch((err) => {
        logger.error('Error notifying new property (non-critical)', 'Property', err as Error);
      });
      checkDuplicateProperty(newProperty.id)
        .then((candidates) => {
          if (candidates.length > 0) return saveDuplicateAlerts(newProperty.id, candidates);
        })
        .catch((e) => {
          logger.debug('Duplicate check failed (non-critical)', 'Property', e as Error);
        });
    });

    const propertyWithUrls = {
      ...newProperty,
      images: newProperty.images ? newProperty.images.map((img: any) => img.url) : []
    };

    logger.info(`Propiedad creada y verificada: ${newProperty.title}`, 'Property', {
      propertyId: newProperty.id,
      ownerId,
      verificationScore: verification.score,
    });
    res.status(201).json({
      ...propertyWithUrls,
      duplicateAlerts: [],
      verification: { verified: true, score: verification.score },
    });
  } catch (error) {
    logger.error('Error al crear propiedad', 'Property', error as Error, { title, ownerId });
    throw error; // Dejar que el error handler lo maneje
  }
}));

// Listado con métricas: disponibilidad + promedio y cantidad de reviews + paginación (con caché)
const WITH_METRICS_CACHE_TTL = 2 * 60 * 1000; // 2 minutos

router.get('/with-metrics', asyncHandler(async (req, res) => {
  const { location, minPrice, maxPrice, sort, page = '1', pageSize = '12', query, bedrooms, rooms, bathrooms, amenities, propertyType, verified } = req.query as any;

  if (shouldTryRealSeed(location, query)) {
    const currentCount = await prisma.property.count();
    if (currentCount < 40) {
      void ensureRealMiamiSeedSafe();
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
  if (rooms != null && rooms !== '') where.rooms = Number(rooms);
  if (bathrooms != null && bathrooms !== '') where.bathrooms = Number(bathrooms);
  if (propertyType) where.propertyType = propertyType;
  if (verified === true || verified === 'true') where.verified = true;

  const parsedMetrics = parsePropertySearchQuery(query);
  if ((rooms == null || rooms === '') && parsedMetrics.roomsExact != null) where.rooms = parsedMetrics.roomsExact;
  if ((bedrooms == null || bedrooms === '') && parsedMetrics.bedroomsExact != null) {
    where.bedrooms = parsedMetrics.bedroomsExact;
  }
  if ((bathrooms == null || bathrooms === '') && parsedMetrics.bathroomsExact != null) {
    where.bathrooms = parsedMetrics.bathroomsExact;
  }

  const amenityFilters = Array.isArray(amenities)
    ? amenities
    : amenities
    ? [amenities]
    : [];
  const requiredAmenities = Array.from(new Set([
    ...amenityFilters.map((a: string) => String(a).toLowerCase()),
    ...parsedMetrics.amenityTerms.map((a) => a.toLowerCase()),
  ]));

  const andClauses: any[] = [];
  if (query && parsedMetrics.textTokens.length > 0) {
    for (const token of parsedMetrics.textTokens) {
      andClauses.push({
        OR: [
          { title: { contains: token } },
          { description: { contains: token } },
          { location: { contains: token } },
        ],
      });
    }
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
        ownerId: true,
        title: true,
        location: true,
        price: true,
        rooms: true,
        bathrooms: true,
        latitude: true,
        longitude: true,
        rentalMonths: true,
        videoTourUrl: true,
        images: { select: { url: true } },
      },
    }),
  ]);

  if (properties.length === 0) {
    const empty = { items: [], total: 0, page: Number(page), pageSize: take };
    cache.set(cacheKey, empty, WITH_METRICS_CACHE_TTL);
    return res.json(empty);
  }

  const ids = properties.map((p: any) => p.id);

  const [reviewAgg, occupied] = await Promise.all([
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
  ]);

  const avgMap = new Map(reviewAgg.map((r) => [r.propertyId, r._avg.rating ?? 0]));
  const countMap = new Map(reviewAgg.map((r) => [r.propertyId, r._count._all]));
  const occupiedSet = new Set(occupied.map((o) => o.propertyId));

  const ownerIdSet = new Set<number>();
  for (const p of properties) {
    if (p.ownerId) ownerIdSet.add(p.ownerId);
  }

  const owners = ownerIdSet.size
    ? await prisma.user.findMany({
        where: { id: { in: Array.from(ownerIdSet) } },
        select: { id: true, name: true, role: true },
      })
    : [];
  const ownerMap = new Map(owners.map((u) => [u.id, u]));

  // Traer información de perfil de broker (para badge y datos en el listing).
  // En algunos entornos legacy la tabla puede no existir aún; no bloquear el listado.
  let brokerProfiles: any[] = [];
  if (ownerIdSet.size) {
    try {
      brokerProfiles = await (prisma as any).brokerProfile.findMany({
        where: { userId: { in: Array.from(ownerIdSet) } },
        select: {
          userId: true,
          brokerageName: true,
          licenseState: true,
          licenseType: true,
          licenseExpiration: true,
          verificationStatus: true,
        },
      });
    } catch (error) {
      logger.warn('No se pudo consultar brokerProfile; se continúa sin badge de broker', 'Property', {
        error: error instanceof Error ? error.message : String(error),
      });
      brokerProfiles = [];
    }
  }
  const brokerProfileMap = new Map(
    brokerProfiles.map((bp: any) => [bp.userId, bp])
  );

  const items = properties.map((p: any) => {
    const ownerId = p.ownerId ?? null;
    const owner = ownerId ? ownerMap.get(ownerId) ?? null : null;
    const brokerProfile = ownerId ? (brokerProfileMap.get(ownerId) as any | null) ?? null : null;
    const imageUrls = Array.isArray(p.images)
      ? p.images.map((img: any) => typeof img === 'string' ? img : img.url)
      : [];
    const orderedImageUrls = orderImagesForReliability(imageUrls);
    return {
      property: {
        ...p,
        images: orderedImageUrls,
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

// PATCH (protegido): solo el dueño o admin
router.patch('/:id', auth, asyncHandler(async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.id);
  const updates = req.body as Partial<{ title: string; description: string; price: number | string; location: string; images: string[]; bedrooms: number | string; rooms: number | string; bathrooms: number | string; latitude: number; longitude: number }>;

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
    if (updates.latitude !== undefined) {
      const lat = updates.latitude as unknown
      allowed.latitude = lat === null || lat === '' ? null : Number(lat)
    }
    if (updates.longitude !== undefined) {
      const lng = updates.longitude as unknown
      allowed.longitude = lng === null || lng === '' ? null : Number(lng)
    }

    const updated = await prisma.property.update({
      where: { id: propertyId },
      data: allowed,
      include: { images: true, reviews: true, bookings: true },
    });
    
    cache.delete(CacheKeys.property(propertyId));
    cache.delete(CacheKeys.propertySummary(propertyId));
    cache.deleteByPrefix('properties:');
    
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
    
    cache.delete(CacheKeys.property(propertyId));
    cache.delete(CacheKeys.propertySummary(propertyId));
    cache.deleteByPrefix('properties:');
    
    logger.info(`Propiedad eliminada`, 'Property', { propertyId });
    res.json({ success: true });
  } catch (error) {
    logger.error('Error al borrar propiedad', 'Property', error as Error, { propertyId });
    throw error;
  }
}));

// Alertas de posible duplicado para una propiedad (propietario o admin)
router.post('/:id/visits', auth, asyncHandler(async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.id);
  if (!Number.isFinite(propertyId)) {
    return res.status(400).json({ error: 'ID de propiedad inválido' });
  }

  const { date, time, visitType, message } = req.body as {
    date?: string;
    time?: string;
    visitType?: 'in_person' | 'video_call';
    message?: string;
  };

  if (!date || !time) {
    return res.status(400).json({ error: 'date y time son requeridos' });
  }

  try {
    const result = await schedulePropertyVisit(propertyId, req.user!.id, {
      date,
      time,
      visitType,
      message,
    });
    return res.status(201).json(result);
  } catch (err: unknown) {
    const statusCode =
      err && typeof err === 'object' && 'statusCode' in err
        ? Number((err as { statusCode: number }).statusCode)
        : 500;
    const errorMessage =
      err instanceof Error ? err.message : 'Error al agendar la visita';
    return res.status(statusCode >= 400 && statusCode < 500 ? statusCode : 500).json({
      error: errorMessage,
    });
  }
}));

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
        description: true,
        location: true,
        price: true,
        bedrooms: true,
        rooms: true,
        bathrooms: true,
        area: true,
        propertyType: true,
        images: true,
        latitude: true,
        longitude: true,
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
    // Evitar SQL crudo para mantener compatibilidad entre SQLite/PostgreSQL.
    const ownerRecord = await (prisma.property as any).findUnique({
      where: { id: propertyId },
      select: { ownerId: true },
    });
    const ownerId = ownerRecord?.ownerId ?? null;
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
    const orderedImageUrls = orderImagesForReliability(imageUrls);
    
    const locationParts = extractLocationParts((propertyBase as any).location);
    const bedrooms = (propertyBase as any).bedrooms ?? (propertyBase as any).rooms ?? 1;
    const bathrooms = (propertyBase as any).bathrooms ?? 1;
    const area = (propertyBase as any).area ?? 75;
    const propertyType = normalizePropertyType((propertyBase as any).propertyType);
    const amenityHints = buildAmenityHints((propertyBase as any).description);

    const property = {
      ...(propertyBase as any),
      subtitle: propertyType === 'house' ? 'HOUSE' : propertyType === 'apartment' ? 'APARTMENT' : propertyType.toUpperCase(),
      neighborhood: locationParts.city,
      city: locationParts.city,
      country: locationParts.stateOrCountry === 'FL' ? 'USA' : locationParts.stateOrCountry,
      currency: 'USD',
      bedrooms,
      rooms: (propertyBase as any).rooms ?? bedrooms,
      beds: bedrooms,
      bathrooms,
      area,
      type: propertyType,
      availableNow: isAvailable,
      availableFor: ['rent'],
      salePrice: null,
      deposit: Math.max(500, Math.round(Number((propertyBase as any).price || 0) * 0.5)),
      hoa: null,
      yearBuilt: null,
      parking: amenityHints.includes('Parking') ? 1 : 0,
      amenities: amenityHints,
      buildingAmenities: amenityHints.filter((a) => ['Pool', 'Gym', 'Elevator'].includes(a)),
      safety: ['Smoke detectors'],
      highlights: [
        'Verified listing',
        'Miami market data',
      ],
      images: orderedImageUrls,
      owner,
      broker,
    } as any;

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
