import {
  LISTING_VIDEO_MAX_BYTES,
  LISTING_VIDEO_MIN_BYTES,
  MIAMI_DADE_BOUNDS,
} from '../config/listingVerification.config';
import type { ListingCheckResult } from './listingVerification.types';

function parseDataUrl(url: string): { mime: string; buffer: Buffer } | null {
  if (!url.startsWith('data:')) return null;
  const match = url.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) return null;
  try {
    return { mime: match[1].toLowerCase(), buffer: Buffer.from(match[2], 'base64') };
  } catch {
    return null;
  }
}

function isWithinMiamiDade(lat: number, lng: number): boolean {
  return (
    lat >= MIAMI_DADE_BOUNDS.latMin &&
    lat <= MIAMI_DADE_BOUNDS.latMax &&
    lng >= MIAMI_DADE_BOUNDS.lngMin &&
    lng <= MIAMI_DADE_BOUNDS.lngMax
  );
}

export function verifyListingLocation(
  latitude?: number | null,
  longitude?: number | null,
  location?: string
): ListingCheckResult {
  if (typeof latitude === 'number' && typeof longitude === 'number' && Number.isFinite(latitude)) {
    if (!isWithinMiamiDade(latitude, longitude)) {
      return {
        verified: false,
        score: 0,
        reason:
          'La ubicación en el mapa debe estar dentro del área de Miami-Dade, Florida.',
      };
    }
    return { verified: true, score: 1 };
  }

  const loc = (location || '').toLowerCase();
  const miamiHints = ['miami', 'dade', 'florida', 'fl ', 'coral gables', 'hialeah', 'kendall', 'brickell'];
  if (miamiHints.some((h) => loc.includes(h))) {
    return { verified: true, score: 0.85 };
  }

  return {
    verified: false,
    score: 0,
    reason: 'Marcá la propiedad en el mapa dentro de Miami-Dade o indicá una ubicación en esa zona.',
  };
}

export function verifyVideoTour(videoUrl: string): ListingCheckResult {
  if (!videoUrl?.trim()) {
    return { verified: false, score: 0, reason: 'Falta el video tour de la propiedad.' };
  }

  const parsed = parseDataUrl(videoUrl);
  if (!parsed) {
    return {
      verified: false,
      score: 0,
      reason: 'El video tour debe subirse como archivo de video (MP4, WebM, etc.).',
    };
  }

  const { buffer, mime } = parsed;
  const isVideo =
    mime.startsWith('video/') ||
    mime.includes('mp4') ||
    mime.includes('webm') ||
    mime.includes('quicktime');
  if (!isVideo) {
    return {
      verified: false,
      score: 0,
      reason: 'Formato de video no válido. Usá MP4 o WebM.',
    };
  }

  if (buffer.length < LISTING_VIDEO_MIN_BYTES) {
    return {
      verified: false,
      score: 0,
      reason: 'El video tour es demasiado corto o liviano. Grabá un recorrido real de al menos unos segundos.',
    };
  }
  if (buffer.length > LISTING_VIDEO_MAX_BYTES) {
    return {
      verified: false,
      score: 0,
      reason: 'El video tour supera el tamaño máximo permitido.',
    };
  }

  return { verified: true, score: 0.9 };
}
