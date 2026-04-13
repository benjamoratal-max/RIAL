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
  const seen = new Set<string>();
  const out: NormalizedListing[] = [];
  for (const row of rows) {
    const key = `${row.title.toLowerCase()}|${row.location.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
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

