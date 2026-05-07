import prisma from '../lib/prisma';
import config from '../config/env';
import { logger } from '../utils/logger';

type NormalizedListing = {
  title: string;
  description: string;
  location: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  rooms: number | null;
  area: number | null;
  propertyType: string | null;
  imageUrls: string[];
  verified: boolean;
};

function toImageUrl(value: any): string | null {
  if (typeof value === 'string' && /^https?:\/\//i.test(value)) return value;
  if (value && typeof value === 'object') {
    const candidates = [value.url, value.href, value.src, value.imageUrl, value.photoUrl];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && /^https?:\/\//i.test(candidate)) return candidate;
    }
  }
  return null;
}

function extractImageUrls(raw: any): string[] {
  const buckets: any[] = [];
  if (Array.isArray(raw?.photos)) buckets.push(...raw.photos);
  if (Array.isArray(raw?.images)) buckets.push(...raw.images);
  if (Array.isArray(raw?.media)) buckets.push(...raw.media);
  if (raw?.primaryPhotoUrl) buckets.push(raw.primaryPhotoUrl);
  if (raw?.photoUrl) buckets.push(raw.photoUrl);
  if (raw?.imageUrl) buckets.push(raw.imageUrl);
  if (raw?.thumbnailUrl) buckets.push(raw.thumbnailUrl);

  const urls = buckets
    .map(toImageUrl)
    .filter((url): url is string => Boolean(url));

  return Array.from(new Set(urls));
}

function normalizeAddressKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

function listingQualityScore(listing: NormalizedListing): number {
  let score = 0;
  if (listing.imageUrls.length > 0) score += 5;
  if (listing.area != null) score += 2;
  if (listing.propertyType) score += 2;
  if (listing.bedrooms != null) score += 1;
  if (listing.bathrooms != null) score += 1;
  if (listing.description && !listing.description.toLowerCase().includes('open data')) score += 1;
  return score;
}

function toNumber(value: any): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function cleanText(value: any, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const v = value.trim();
  return v || fallback;
}

function normalizeRentcastListing(raw: any): NormalizedListing | null {
  const addressParts = [
    raw?.addressLine1 || raw?.address || raw?.formattedAddress,
    raw?.city,
    raw?.state,
    raw?.zipCode,
  ].filter(Boolean);
  const location = cleanText(addressParts.join(', '), 'Miami, FL');

  const parsedPrice = toNumber(raw?.price ?? raw?.rent ?? raw?.listingPrice);
  // RentCast puede devolver listings sin precio publicado; no descartarlos para enriquecer campos.
  const price = parsedPrice && parsedPrice > 0 ? parsedPrice : 1800;

  const bedrooms = toNumber(raw?.bedrooms ?? raw?.beds);
  const bathrooms = toNumber(raw?.bathrooms ?? raw?.baths);
  const rooms = bedrooms != null ? bedrooms + 1 : null;
  const area = toNumber(raw?.squareFootage ?? raw?.livingArea ?? raw?.sqft);

  const imageUrls = extractImageUrls(raw);

  const title = cleanText(raw?.formattedAddress || raw?.addressLine1 || raw?.address, `Miami Listing ${raw?.id ?? ''}`.trim());
  const description = cleanText(
    raw?.description,
    `Real listing imported from RentCast (${raw?.propertyType || 'residential'}).`
  );

  return {
    title,
    description,
    location,
    price,
    bedrooms,
    bathrooms,
    rooms,
    area,
    propertyType: cleanText(raw?.propertyType, null as any) || null,
    imageUrls,
    verified: true,
  };
}

async function fetchRentcastMiami(limit = 80): Promise<NormalizedListing[]> {
  const apiKey = config.rentcastApiKey;
  if (!apiKey) {
    logger.warn('RENTCAST_API_KEY no configurada; se omite importación RentCast', 'RealListings');
    return [];
  }

  const url = new URL('https://api.rentcast.io/v1/listings/rental/long-term');
  url.searchParams.set('city', 'Miami');
  url.searchParams.set('state', 'FL');
  url.searchParams.set('limit', String(limit));

  try {
    const res = await fetch(url.toString(), {
      headers: { 'X-Api-Key': apiKey },
    });
    if (!res.ok) {
      let bodySnippet = '';
      try {
        bodySnippet = (await res.text()).slice(0, 300);
      } catch {
        bodySnippet = '';
      }
      logger.warn(`RentCast respondió ${res.status}`, 'RealListings', { bodySnippet });
      return [];
    }
    const data = await res.json();
    const rows =
      Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
        ? data.results
        : Array.isArray((data as any)?.data)
        ? (data as any).data
        : Array.isArray((data as any)?.listings)
        ? (data as any).listings
        : [];
    return rows.map(normalizeRentcastListing).filter(Boolean) as NormalizedListing[];
  } catch (error) {
    logger.error('Error consultando RentCast', 'RealListings', error as Error);
    return [];
  }
}

function normalizeArcgisFeature(feature: any): NormalizedListing | null {
  const a = feature?.attributes || {};
  const geometry = feature?.geometry || {};
  const location = cleanText(
    [a.TRUE_SITE_ADDR, a.TRUE_SITE_CITY || 'Miami', 'FL', a.TRUE_SITE_ZIP_CODE].filter(Boolean).join(', '),
    'Miami, FL'
  );
  const bedrooms = toNumber(a.BEDROOM_COUNT);
  const bathrooms = toNumber(a.BATHROOM_COUNT);
  const area = toNumber(a.BUILDING_HEATED_AREA);
  const assessed = toNumber(a.ASSESSED_VAL_CUR) || 0;
  const estimatedRent = assessed > 0 ? Math.max(1200, Math.round((assessed * 0.006) / 50) * 50) : 1800;
  const title = cleanText(a.TRUE_SITE_ADDR, `Property ${a.FOLIO || ''}`.trim());
  if (!title) return null;

  return {
    title,
    description: `Real property record from Miami-Dade Open Data. FOLIO: ${a.FOLIO || 'N/A'}.`,
    location,
    price: estimatedRent,
    bedrooms,
    bathrooms,
    rooms: bedrooms != null ? bedrooms + 1 : null,
    area,
    propertyType: cleanText(a.DOR_DESC, null as any) || null,
    imageUrls: [],
    verified: true,
  };
}

async function fetchArcgisMiami(limit = 120): Promise<NormalizedListing[]> {
  const base = 'https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/PaGISView_gdb/FeatureServer/0/query';
  const url = new URL(base);
  url.searchParams.set('where', "DOR_CODE_CUR LIKE '01%'");
  url.searchParams.set('outFields', 'FOLIO,TRUE_SITE_ADDR,TRUE_SITE_CITY,TRUE_SITE_ZIP_CODE,BEDROOM_COUNT,BATHROOM_COUNT,BUILDING_HEATED_AREA,DOR_DESC,ASSESSED_VAL_CUR');
  url.searchParams.set('outSR', '4326');
  url.searchParams.set('f', 'json');
  url.searchParams.set('resultRecordCount', String(limit));

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    const features = Array.isArray(data?.features) ? data.features : [];
    return features.map(normalizeArcgisFeature).filter(Boolean) as NormalizedListing[];
  } catch (error) {
    logger.error('Error consultando ArcGIS Miami-Dade', 'RealListings', error as Error);
    return [];
  }
}

function dedupeListings(rows: NormalizedListing[]): NormalizedListing[] {
  const byKey = new Map<string, NormalizedListing>();
  for (const row of rows) {
    const key = `${normalizeAddressKey(row.title)}|${normalizeAddressKey(row.location)}`;
    const current = byKey.get(key);
    if (!current || listingQualityScore(row) > listingQualityScore(current)) {
      byKey.set(key, row);
    }
  }
  return Array.from(byKey.values());
}

export async function syncMiamiRealListings(target = 120): Promise<{ imported: number; updated: number; totalFetched: number }> {
  const [rentcast, arcgis] = await Promise.all([
    fetchRentcastMiami(target),
    fetchArcgisMiami(target),
  ]);
  const merged = dedupeListings([...rentcast, ...arcgis]).slice(0, target);

  let imported = 0;
  let updated = 0;
  for (const row of merged) {
    const existing = await prisma.property.findFirst({
      where: {
        title: row.title,
        location: row.location,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.property.update({
        where: { id: existing.id },
        data: {
          description: row.description,
          price: row.price,
          bedrooms: row.bedrooms,
          bathrooms: row.bathrooms,
          rooms: row.rooms,
          area: row.area,
          propertyType: row.propertyType,
          verified: row.verified,
        },
      });
      if (row.imageUrls.length) {
        await prisma.image.deleteMany({ where: { propertyId: existing.id } });
        await prisma.image.createMany({
          data: row.imageUrls.map((url) => ({ propertyId: existing.id, url })),
        });
      }
      updated++;
    } else {
      await prisma.property.create({
        data: {
          title: row.title,
          description: row.description,
          location: row.location,
          price: row.price,
          bedrooms: row.bedrooms,
          bathrooms: row.bathrooms,
          rooms: row.rooms,
          area: row.area,
          propertyType: row.propertyType,
          verified: row.verified,
          images: row.imageUrls.length
            ? { create: row.imageUrls.map((url) => ({ url })) }
            : undefined,
        },
      });
      imported++;
    }
  }

  logger.info('Sync Miami real listings completado', 'RealListings', {
    totalFetched: merged.length,
    imported,
    updated,
  });
  return { imported, updated, totalFetched: merged.length };
}

export async function enrichMiamiListingsFromRentcast(limit = 300): Promise<{ matched: number; updated: number; imagesAdded: number; rentcastRows: number }> {
  const rentcastRows = await fetchRentcastMiami(limit);
  if (rentcastRows.length === 0) {
    return { matched: 0, updated: 0, imagesAdded: 0, rentcastRows: 0 };
  }

  const byAddress = new Map<string, NormalizedListing>();
  for (const row of rentcastRows) {
    byAddress.set(normalizeAddressKey(row.title), row);
  }

  const existing = await (prisma.property as any).findMany({
    where: {
      OR: [
        { location: { contains: 'Miami' } },
        { title: { contains: 'NW' } },
        { title: { contains: 'NE' } },
        { title: { contains: 'SW' } },
        { title: { contains: 'SE' } },
      ],
    },
    select: {
      id: true,
      title: true,
      location: true,
      description: true,
      bedrooms: true,
      bathrooms: true,
      rooms: true,
      area: true,
      propertyType: true,
      images: { select: { url: true } },
    },
  });

  let matched = 0;
  let updated = 0;
  let imagesAdded = 0;

  for (const prop of existing) {
    const titleKey = normalizeAddressKey(String(prop.title || ''));
    const locationFirstPart = String(prop.location || '').split(',')[0] || '';
    const locationKey = normalizeAddressKey(locationFirstPart);
    const source = byAddress.get(titleKey) || byAddress.get(locationKey);
    if (!source) continue;

    matched++;
    const data: any = {};
    if (source.description && (!prop.description || prop.description.toLowerCase().includes('open data'))) data.description = source.description;
    if (source.bedrooms != null && prop.bedrooms == null) data.bedrooms = source.bedrooms;
    if (source.bathrooms != null && prop.bathrooms == null) data.bathrooms = source.bathrooms;
    if (source.rooms != null && prop.rooms == null) data.rooms = source.rooms;
    if (source.area != null && prop.area == null) data.area = source.area;
    if (source.propertyType && !prop.propertyType) data.propertyType = source.propertyType;
    data.verified = true;

    if (Object.keys(data).length > 0) {
      await prisma.property.update({ where: { id: prop.id }, data });
      updated++;
    }

    const existingImagesCount = Array.isArray(prop.images) ? prop.images.length : 0;
    if (source.imageUrls.length > 0) {
      const existingImageSet = new Set((prop.images || []).map((img: any) => String(img.url || '').trim()).filter(Boolean));
      const missingUrls = source.imageUrls.filter((url) => !existingImageSet.has(url));
      if (missingUrls.length === 0) continue;

      await prisma.image.createMany({
        data: missingUrls.map((url) => ({ propertyId: prop.id, url })),
      });
      imagesAdded += missingUrls.length;
    }
  }

  logger.info('Enriquecimiento Miami desde RentCast completado', 'RealListings', {
    rentcastRows: rentcastRows.length,
    matched,
    updated,
    imagesAdded,
  });

  return { matched, updated, imagesAdded, rentcastRows: rentcastRows.length };
}

function buildStreetViewUrl(address: string, apiKey: string): string {
  const url = new URL('https://maps.googleapis.com/maps/api/streetview');
  url.searchParams.set('size', '1200x800');
  url.searchParams.set('location', address);
  url.searchParams.set('fov', '80');
  url.searchParams.set('pitch', '0');
  url.searchParams.set('key', apiKey);
  return url.toString();
}

export async function enrichMiamiListingsWithStreetView(limit = 250): Promise<{ processed: number; imagesAdded: number; skippedWithImages: number; skippedNoApiKey: boolean }> {
  const apiKey = config.googleMapsApiKey;
  if (!apiKey) {
    logger.warn('GOOGLE_MAPS_API_KEY no configurada; se omite enriquecimiento Street View', 'RealListings');
    return { processed: 0, imagesAdded: 0, skippedWithImages: 0, skippedNoApiKey: true };
  }

  const properties = await (prisma.property as any).findMany({
    where: {
      OR: [
        { location: { contains: 'Miami' } },
        { title: { contains: 'NW' } },
        { title: { contains: 'NE' } },
        { title: { contains: 'SW' } },
        { title: { contains: 'SE' } },
      ],
    },
    take: limit,
    orderBy: { id: 'asc' },
    select: {
      id: true,
      title: true,
      location: true,
      images: { select: { url: true } },
    },
  });

  let processed = 0;
  let imagesAdded = 0;
  let skippedWithImages = 0;

  for (const prop of properties) {
    const hasImages = Array.isArray(prop.images) && prop.images.length > 0;
    if (hasImages) {
      skippedWithImages++;
      continue;
    }

    const addressCandidate = String(prop.location || prop.title || '').trim();
    if (!addressCandidate) continue;

    const streetViewUrl = buildStreetViewUrl(addressCandidate, apiKey);
    await prisma.image.create({
      data: {
        propertyId: prop.id,
        url: streetViewUrl,
      },
    });
    imagesAdded++;
    processed++;
  }

  logger.info('Enriquecimiento Street View completado', 'RealListings', {
    processed,
    imagesAdded,
    skippedWithImages,
    totalCandidates: properties.length,
  });

  return { processed, imagesAdded, skippedWithImages, skippedNoApiKey: false };
}

function buildAiMiamiPrompt(property: {
  title?: string | null;
  description?: string | null;
  location?: string | null;
  propertyType?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  area?: number | null;
  price?: number | null;
}): string {
  const type = property.propertyType || 'residential home';
  const beds = property.bedrooms != null ? `${property.bedrooms} bed` : '';
  const baths = property.bathrooms != null ? `${property.bathrooms} bath` : '';
  const area = property.area != null ? `${Math.round(property.area)} sqm` : '';
  const location = String(property.location || 'Miami, Florida').slice(0, 80);
  const hint = String(property.description || '').slice(0, 90);

  return [
    'photorealistic exterior real estate photo',
    'Miami Florida neighborhood',
    'daylight, wide angle, high detail',
    type,
    beds,
    baths,
    area,
    location,
    String(property.title || '').slice(0, 60),
    hint,
    'no text, no watermark, no logo',
  ]
    .filter(Boolean)
    .join(', ');
}

function simpleHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function normalizeTypeForPrompt(propertyType?: string | null): string {
  const value = String(propertyType || '').toLowerCase();
  if (value.includes('house') || value.includes('villa') || value.includes('single')) return 'modern house';
  if (value.includes('condo') || value.includes('apartment') || value.includes('studio')) return 'modern apartment building';
  return 'modern residential property';
}

function buildAiImageUrl(prompt: string, seed: string): string {
  const encodedPrompt = encodeURIComponent(prompt);
  // Pollinations es gratuito y no requiere API key para imágenes básicas.
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=640&seed=${encodeURIComponent(seed)}&model=flux&nologo=true`;
}

function buildFallbackImageUrl(propertyId: number): string {
  return `https://picsum.photos/seed/rial-miami-${propertyId}/1024/640`;
}

async function resolveStableImageUrl(primaryUrl: string, fallbackUrl: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(primaryUrl, { signal: controller.signal });
    clearTimeout(timeout);

    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('image')) return primaryUrl;
    return fallbackUrl;
  } catch {
    return fallbackUrl;
  }
}

export async function enrichMiamiListingsWithAIGeneratedPhotos(limit = 250): Promise<{ processed: number; imagesAdded: number; skippedWithImages: number }> {
  const properties = await (prisma.property as any).findMany({
    where: {
      OR: [
        { location: { contains: 'Miami' } },
        { title: { contains: 'NW' } },
        { title: { contains: 'NE' } },
        { title: { contains: 'SW' } },
        { title: { contains: 'SE' } },
      ],
    },
    take: limit,
    orderBy: { id: 'asc' },
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      propertyType: true,
      bedrooms: true,
      bathrooms: true,
      area: true,
      price: true,
      images: { select: { url: true } },
    },
  });

  let processed = 0;
  let imagesAdded = 0;
  let skippedWithImages = 0;

  for (const prop of properties) {
    const currentImages = Array.isArray(prop.images) ? prop.images : [];
    const hasNonAiImages = currentImages.some((img: any) => {
      const url = String(img?.url || '');
      return !url.includes('image.pollinations.ai/prompt/') && !url.includes('picsum.photos/seed/rial-miami-');
    });
    // Mantener intactas imágenes no-IA/subidas manualmente.
    if (hasNonAiImages) {
      skippedWithImages++;
      continue;
    }

    const typeHint = normalizeTypeForPrompt(prop.propertyType);
    const styleVariants = [
      'contemporary architecture, realistic materials, clean landscaping',
      'tropical modern facade, palm trees, sunny weather',
      'urban residential design, natural lighting, high realism',
      'coastal luxury style, Miami ambience, sharp details',
    ];
    const variant = styleVariants[simpleHash(`${prop.id}-${prop.title || ''}`) % styleVariants.length];
    const prompt = `${buildAiMiamiPrompt(prop)}, ${typeHint}, ${variant}`;
    const seed = `miami-${prop.id}-${simpleHash(String(prop.title || 'property'))}`;
    const primaryImageUrl = buildAiImageUrl(prompt, seed);
    const fallbackImageUrl = buildFallbackImageUrl(prop.id);
    const finalImageUrl = await resolveStableImageUrl(primaryImageUrl, fallbackImageUrl);

    // Si tenía imágenes IA previas/fallback previos, se reemplazan por una sola imagen estable y única.
    if (currentImages.length > 0) {
      await prisma.image.deleteMany({ where: { propertyId: prop.id } });
    }
    await prisma.image.create({ data: { propertyId: prop.id, url: finalImageUrl } });
    processed++;
    imagesAdded++;
  }

  logger.info('Enriquecimiento con imágenes IA (demo) completado', 'RealListings', {
    processed,
    imagesAdded,
    skippedWithImages,
    totalCandidates: properties.length,
  });

  return { processed, imagesAdded, skippedWithImages };
}

