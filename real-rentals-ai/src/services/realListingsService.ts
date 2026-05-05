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

  const price = toNumber(raw?.price ?? raw?.rent ?? raw?.listingPrice);
  if (!price || price <= 0) return null;

  const bedrooms = toNumber(raw?.bedrooms ?? raw?.beds);
  const bathrooms = toNumber(raw?.bathrooms ?? raw?.baths);
  const rooms = bedrooms != null ? bedrooms + 1 : null;
  const area = toNumber(raw?.squareFootage ?? raw?.livingArea ?? raw?.sqft);

  const photos = Array.isArray(raw?.photos)
    ? raw.photos
    : Array.isArray(raw?.images)
    ? raw.images
    : [];

  const imageUrls = photos
    .map((p: any) => (typeof p === 'string' ? p : p?.url))
    .filter((u: any) => typeof u === 'string' && /^https?:\/\//i.test(u));

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
      logger.warn(`RentCast respondió ${res.status}`, 'RealListings');
      return [];
    }
    const data = await res.json();
    const rows = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
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
    if (existingImagesCount === 0 && source.imageUrls.length > 0) {
      await prisma.image.createMany({
        data: source.imageUrls.map((url) => ({ propertyId: prop.id, url })),
      });
      imagesAdded += source.imageUrls.length;
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

