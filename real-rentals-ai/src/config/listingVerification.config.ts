/**
 * Umbrales de verificación automática de publicaciones (listings).
 * Ajustables vía variables de entorno en producción.
 */

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function envFloat(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

export const LISTING_VERIFICATION_ENABLED =
  process.env.LISTING_VERIFICATION_ENABLED !== 'false';

/** Puntuación mínima global (0–1) para marcar verified=true */
export const LISTING_MIN_OVERALL_SCORE = envFloat('LISTING_MIN_OVERALL_SCORE', 0.72);

/** Peso por bloque en el score global */
export const LISTING_SCORE_WEIGHTS = {
  ownerDni: 0.3,
  contract: 0.25,
  photos: 0.3,
  videoTour: 0.15,
} as const;

/** Fotos de la propiedad */
export const LISTING_MIN_PHOTOS = 8;
export const LISTING_MAX_PHOTOS = 30;
export const LISTING_PHOTO_MIN_WIDTH = envInt('LISTING_PHOTO_MIN_WIDTH', 640);
export const LISTING_PHOTO_MIN_HEIGHT = envInt('LISTING_PHOTO_MIN_HEIGHT', 480);
export const LISTING_PHOTO_MIN_BYTES = envInt('LISTING_PHOTO_MIN_BYTES', 12_000);
export const LISTING_PHOTO_MAX_BYTES = envInt('LISTING_PHOTO_MAX_BYTES', 4_000_000);
export const LISTING_PHOTO_ASPECT_MIN = 0.45;
export const LISTING_PHOTO_ASPECT_MAX = 2.4;
/** Mínimo de fotos con dimensiones distintas (evita 8 capturas idénticas) */
export const LISTING_PHOTO_MIN_DISTINCT_DIMENSIONS = 3;
/** Máximo de fotos con el mismo hash parcial (duplicados) */
export const LISTING_PHOTO_MAX_DUPLICATE_HASHES = 2;
/** Cuántas fotos se analizan con OCR (muestra) */
export const LISTING_PHOTO_OCR_SAMPLE_SIZE = 4;
/** Si en OCR aparecen muchas palabras de DNI, se rechaza como foto de propiedad */
export const LISTING_PHOTO_MAX_ID_KEYWORD_HITS = 4;

/** Video tour */
export const LISTING_VIDEO_MIN_BYTES = envInt('LISTING_VIDEO_MIN_BYTES', 200_000);
export const LISTING_VIDEO_MAX_BYTES = envInt('LISTING_VIDEO_MAX_BYTES', 50_000_000);

/** Contrato / título */
export const LISTING_CONTRACT_MIN_BYTES = envInt('LISTING_CONTRACT_MIN_BYTES', 8_000);
export const LISTING_CONTRACT_MAX_BYTES = envInt('LISTING_CONTRACT_MAX_BYTES', 8_000_000);
export const LISTING_CONTRACT_MIN_KEYWORDS = 2;
export const LISTING_CONTRACT_IMAGE_MIN_WIDTH = 500;
export const LISTING_CONTRACT_IMAGE_MIN_HEIGHT = 400;

/** DNI del propietario — score mínimo del verificador de identidad */
export const LISTING_DNI_MIN_SCORE = envFloat('LISTING_DNI_MIN_SCORE', 0.8);

/** Coordenadas: Miami-Dade (aprox.) */
export const MIAMI_DADE_BOUNDS = {
  latMin: 25.14,
  latMax: 25.98,
  lngMin: -80.88,
  lngMax: -80.12,
} as const;

export const CONTRACT_TITLE_KEYWORDS = [
  'contrato',
  'contract',
  'lease',
  'alquiler',
  'arrendamiento',
  'rental agreement',
  'landlord',
  'lessor',
  'lessee',
  'tenant',
  'arrendador',
  'arrendatario',
  'propiedad',
  'property',
  'premises',
  'dwelling',
  'título',
  'title',
  'deed',
  'warranty',
  'hipoteca',
  'mortgage',
  'notary',
  'notario',
  'condominium',
  'association',
  'florida',
  'residential',
  'inmueble',
  'arrendamiento',
  'monthly rent',
  'renta',
] as const;

export const ID_DOCUMENT_KEYWORDS_FOR_PHOTO_REJECT = [
  'dni',
  'cédula',
  'cedula',
  'identidad',
  'república',
  'republica',
  'documento nacional',
  'identificación',
  'identificacion',
  'driver license',
  'licencia de conducir',
  'passport',
  'pasaporte',
  'mrz',
] as const;
