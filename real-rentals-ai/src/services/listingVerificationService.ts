import { createHash } from 'crypto';
import {
  CONTRACT_TITLE_KEYWORDS,
  ID_DOCUMENT_KEYWORDS_FOR_PHOTO_REJECT,
  LISTING_CONTRACT_IMAGE_MIN_HEIGHT,
  LISTING_CONTRACT_IMAGE_MIN_WIDTH,
  LISTING_CONTRACT_MAX_BYTES,
  LISTING_CONTRACT_MIN_BYTES,
  LISTING_CONTRACT_MIN_KEYWORDS,
  LISTING_DNI_MIN_SCORE,
  LISTING_MAX_PHOTOS,
  LISTING_MIN_OVERALL_SCORE,
  LISTING_MIN_PHOTOS,
  LISTING_PHOTO_ASPECT_MAX,
  LISTING_PHOTO_ASPECT_MIN,
  LISTING_PHOTO_MAX_BYTES,
  LISTING_PHOTO_MAX_DUPLICATE_HASHES,
  LISTING_PHOTO_MAX_ID_KEYWORD_HITS,
  LISTING_PHOTO_MIN_BYTES,
  LISTING_PHOTO_MIN_DISTINCT_DIMENSIONS,
  LISTING_PHOTO_MIN_HEIGHT,
  LISTING_PHOTO_MIN_WIDTH,
  LISTING_PHOTO_OCR_SAMPLE_SIZE,
  LISTING_SCORE_WEIGHTS,
  LISTING_VERIFICATION_ENABLED,
} from '../config/listingVerification.config';
import { verifyListingLocation, verifyVideoTour } from './listingVerification.rules';
import {
  getImageBuffer,
  getImageDimensions,
  parseDataUrl,
  runOcr,
  runOcrBatch,
  verifyDocumentAutomatically,
  type VerificationResult,
} from '../utils/documentVerification';
import { logger } from '../utils/logger';

import type {
  ListingCheckResult,
  ListingPhotosCheckResult,
  ListingVerificationInput,
  ListingVerificationReport,
} from './listingVerification.types';

export type {
  ListingCheckResult,
  ListingPhotosCheckResult,
  ListingVerificationInput,
  ListingVerificationReport,
} from './listingVerification.types';

function partialHash(buffer: Buffer): string {
  const slice = buffer.subarray(0, Math.min(buffer.length, 8192));
  return createHash('sha256').update(slice).digest('hex').slice(0, 16);
}

function countKeywords(text: string, keywords: readonly string[]): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) hits++;
  }
  return hits;
}

export async function verifyOwnerDniForListing(documentUrl: string): Promise<ListingCheckResult> {
  const result: VerificationResult = await verifyDocumentAutomatically(documentUrl, 'dni');
  const score = result.score ?? 0;
  const verified = result.verified && score >= LISTING_DNI_MIN_SCORE;
  return {
    verified,
    score: verified ? score : Math.min(score, 0.5),
    reason: verified
      ? undefined
      : result.reason ||
        'No se pudo validar el DNI del propietario. Subí una foto clara del documento (frente, buena luz).',
  };
}

export async function verifyContractOrTitle(documentUrl: string): Promise<ListingCheckResult> {
  if (!documentUrl?.trim()) {
    return { verified: false, score: 0, reason: 'Falta el contrato o título de la propiedad.' };
  }

  const parsed = parseDataUrl(documentUrl);
  if (!parsed) {
    return {
      verified: false,
      score: 0,
      reason: 'El contrato o título debe subirse como imagen (JPG/PNG) o PDF.',
    };
  }

  const { buffer, mime } = parsed;
  if (buffer.length < LISTING_CONTRACT_MIN_BYTES) {
    return {
      verified: false,
      score: 0,
      reason: 'El archivo del contrato o título es demasiado pequeño o está vacío.',
    };
  }
  if (buffer.length > LISTING_CONTRACT_MAX_BYTES) {
    return {
      verified: false,
      score: 0,
      reason: 'El contrato o título supera el tamaño máximo permitido.',
    };
  }

  if (mime.includes('pdf') || parsed.extension === 'pdf') {
    const header = buffer.subarray(0, 5).toString('ascii');
    if (!header.startsWith('%PDF')) {
      return { verified: false, score: 0, reason: 'El PDF del contrato no es válido.' };
    }
    const ascii = buffer.subarray(0, Math.min(buffer.length, 50_000)).toString('latin1').toLowerCase();
    const keywordHits = countKeywords(ascii, CONTRACT_TITLE_KEYWORDS);
    const hasLegalMarkers =
      keywordHits >= LISTING_CONTRACT_MIN_KEYWORDS ||
      ascii.includes('/title') ||
      ascii.includes('lease') ||
      ascii.includes('deed');
    if (!hasLegalMarkers) {
      return {
        verified: false,
        score: 0.2,
        reason:
          'El PDF no parece un contrato, arrendamiento o título de propiedad. Subí el documento legal completo.',
      };
    }
    return { verified: true, score: 0.88 };
  }

  if (!mime.startsWith('image/')) {
    return {
      verified: false,
      score: 0,
      reason: 'Formato de contrato no soportado. Usá JPG, PNG o PDF.',
    };
  }

  const dims = getImageDimensions(buffer);
  if (!dims) {
    return { verified: false, score: 0, reason: 'La imagen del contrato no es válida.' };
  }
  if (
    dims.width < LISTING_CONTRACT_IMAGE_MIN_WIDTH ||
    dims.height < LISTING_CONTRACT_IMAGE_MIN_HEIGHT
  ) {
    return {
      verified: false,
      score: 0,
      reason: 'La foto del contrato o título es demasiado pequeña. Debe leerse con claridad.',
    };
  }

  let ocrText = '';
  try {
    ocrText = await runOcr(buffer);
  } catch (e) {
    logger.warn('OCR contrato falló', 'ListingVerification', e as Error);
    return {
      verified: false,
      score: 0,
      reason: 'No se pudo leer el contrato o título. Subí una foto más nítida o un PDF legible.',
    };
  }

  const keywordHits = countKeywords(ocrText, CONTRACT_TITLE_KEYWORDS);
  const hasDateOrAmount = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.test(ocrText) || /\$\s?\d+/.test(ocrText);
  const verified =
    keywordHits >= LISTING_CONTRACT_MIN_KEYWORDS ||
    (keywordHits >= 1 && hasDateOrAmount && ocrText.length >= 80);

  return {
    verified,
    score: verified ? Math.min(1, 0.7 + keywordHits * 0.05) : 0.25,
    reason: verified
      ? undefined
      : 'No se reconoció un contrato, arrendamiento o título de propiedad en el documento. Asegurate de que se vea texto legal legible.',
  };
}

export async function verifyListingPhotos(imageUrls: string[]): Promise<ListingPhotosCheckResult> {
  const total = imageUrls.length;
  if (total < LISTING_MIN_PHOTOS) {
    return {
      verified: false,
      score: 0,
      passed: 0,
      total,
      distinctDimensions: 0,
      reason: `Se requieren al menos ${LISTING_MIN_PHOTOS} fotos de la propiedad.`,
    };
  }
  if (total > LISTING_MAX_PHOTOS) {
    return {
      verified: false,
      score: 0,
      passed: 0,
      total,
      distinctDimensions: 0,
      reason: `Máximo ${LISTING_MAX_PHOTOS} fotos permitidas.`,
    };
  }

  const allowedExt = new Set(['jpeg', 'jpg', 'png', 'webp']);

  type PhotoCheck = {
    ok: boolean;
    failure?: string;
    dimensionKey?: string;
    hash?: string;
    ocrSample?: { index: number; buffer: Buffer };
  };

  const checks = await Promise.all(
    imageUrls.map(async (url, i): Promise<PhotoCheck> => {
      const img = await getImageBuffer(url);
      if (!img) {
        return { ok: false, failure: `Foto ${i + 1}: no es una imagen válida (JPG/PNG).` };
      }
      if (!allowedExt.has(img.extension.toLowerCase())) {
        return { ok: false, failure: `Foto ${i + 1}: no es una imagen válida (JPG/PNG).` };
      }

      const { buffer } = img;
      if (buffer.length < LISTING_PHOTO_MIN_BYTES) {
        return { ok: false, failure: `Foto ${i + 1}: archivo demasiado pequeño o corrupto.` };
      }
      if (buffer.length > LISTING_PHOTO_MAX_BYTES) {
        return { ok: false, failure: `Foto ${i + 1}: supera el tamaño máximo por imagen.` };
      }

      const dims = getImageDimensions(buffer);
      if (!dims) {
        return { ok: false, failure: `Foto ${i + 1}: no se pudieron leer las dimensiones.` };
      }

      const aspect = dims.width / dims.height;
      if (
        dims.width < LISTING_PHOTO_MIN_WIDTH ||
        dims.height < LISTING_PHOTO_MIN_HEIGHT ||
        aspect < LISTING_PHOTO_ASPECT_MIN ||
        aspect > LISTING_PHOTO_ASPECT_MAX
      ) {
        return {
          ok: false,
          failure: `Foto ${i + 1}: resolución o proporción insuficiente (mín. ${LISTING_PHOTO_MIN_WIDTH}×${LISTING_PHOTO_MIN_HEIGHT}px).`,
        };
      }

      const sampleOcr =
        i < 2 || i === imageUrls.length - 1 || i === Math.floor(imageUrls.length / 2);

      return {
        ok: true,
        dimensionKey: `${dims.width}x${dims.height}`,
        hash: partialHash(buffer),
        ocrSample: sampleOcr ? { index: i, buffer } : undefined,
      };
    })
  );

  const dimensionKeys = new Set<string>();
  const hashCounts = new Map<string, number>();
  const failures: string[] = [];
  const buffersForOcr: { index: number; buffer: Buffer }[] = [];
  let passed = 0;

  for (const c of checks) {
    if (!c.ok) {
      if (c.failure) failures.push(c.failure);
      continue;
    }
    passed++;
    if (c.dimensionKey) dimensionKeys.add(c.dimensionKey);
    if (c.hash) hashCounts.set(c.hash, (hashCounts.get(c.hash) || 0) + 1);
    if (c.ocrSample && buffersForOcr.length < LISTING_PHOTO_OCR_SAMPLE_SIZE) {
      buffersForOcr.push(c.ocrSample);
    }
  }

  const minPassRatio = 0.875;
  const minRequired = Math.ceil(total * minPassRatio);

  if (failures.length > 0 && passed < total) {
    return {
      verified: false,
      score: passed / total,
      passed,
      total,
      distinctDimensions: dimensionKeys.size,
      reason:
        failures[0] ||
        `Varias fotos no cumplen calidad mínima (${passed}/${total} válidas).`,
    };
  }

  if (passed < minRequired) {
    return {
      verified: false,
      score: passed / total,
      passed,
      total,
      distinctDimensions: dimensionKeys.size,
      reason:
        failures[0] ||
        `Varias fotos no cumplen calidad mínima (${passed}/${total} válidas, se requieren al menos ${minRequired}).`,
    };
  }

  const maxDup = Math.max(0, ...hashCounts.values());
  if (maxDup > LISTING_PHOTO_MAX_DUPLICATE_HASHES + 1) {
    return {
      verified: false,
      score: 0.2,
      passed,
      total,
      distinctDimensions: dimensionKeys.size,
      reason: 'Demasiadas fotos repetidas o idénticas. Subí vistas distintas de la propiedad.',
    };
  }

  if (dimensionKeys.size < LISTING_PHOTO_MIN_DISTINCT_DIMENSIONS) {
    return {
      verified: false,
      score: 0.35,
      passed,
      total,
      distinctDimensions: dimensionKeys.size,
      reason:
        'Las fotos parecen muy similares entre sí. Incluí distintos ambientes (living, cocina, baño, exterior).',
    };
  }

  if (buffersForOcr.length > 0) {
    try {
      const texts = await runOcrBatch(buffersForOcr.map((b) => b.buffer));
      for (let j = 0; j < texts.length; j++) {
        const idHits = countKeywords(texts[j], ID_DOCUMENT_KEYWORDS_FOR_PHOTO_REJECT);
        if (idHits >= LISTING_PHOTO_MAX_ID_KEYWORD_HITS) {
          const index = buffersForOcr[j].index;
          return {
            verified: false,
            score: 0.3,
            passed,
            total,
            distinctDimensions: dimensionKeys.size,
            reason: `La foto ${index + 1} parece un documento de identidad, no un ambiente de la propiedad.`,
          };
        }
      }
    } catch {
      // OCR opcional en muestra
    }
  }

  const score = Math.min(1, 0.5 + (passed / total) * 0.35 + dimensionKeys.size * 0.02);
  return {
    verified: true,
    score,
    passed,
    total,
    distinctDimensions: dimensionKeys.size,
  };
}

export { verifyListingLocation, verifyVideoTour } from './listingVerification.rules';

function aggregateScore(checks: ListingVerificationReport['checks']): number {
  return (
    (checks.ownerDni.verified ? checks.ownerDni.score : 0) * LISTING_SCORE_WEIGHTS.ownerDni +
    (checks.contract.verified ? checks.contract.score : 0) * LISTING_SCORE_WEIGHTS.contract +
    (checks.photos.verified ? checks.photos.score : 0) * LISTING_SCORE_WEIGHTS.photos +
    (checks.videoTour.verified ? checks.videoTour.score : 0) * LISTING_SCORE_WEIGHTS.videoTour
  );
}

/**
 * Verificación automática completa antes de publicar un listing.
 */
export async function verifyListingForPublish(
  input: ListingVerificationInput
): Promise<ListingVerificationReport> {
  if (!LISTING_VERIFICATION_ENABLED) {
    return {
      verified: true,
      score: 1,
      failures: [],
      checks: {
        ownerDni: { verified: true, score: 1 },
        contract: { verified: true, score: 1 },
        photos: { verified: true, score: 1, passed: input.images.length, total: input.images.length, distinctDimensions: input.images.length },
        videoTour: { verified: true, score: 1 },
        location: { verified: true, score: 1 },
      },
    };
  }

  const [ownerDni, contract, photos] = await Promise.all([
    verifyOwnerDniForListing(input.ownerDniDocumentUrl),
    verifyContractOrTitle(input.contractOrTitleUrl),
    verifyListingPhotos(input.images),
  ]);

  const videoTour = verifyVideoTour(input.videoTourUrl);
  const location = verifyListingLocation(input.latitude, input.longitude, input.location);

  const checks = { ownerDni, contract, photos, videoTour, location };
  const failures: string[] = [];

  if (!ownerDni.verified && ownerDni.reason) failures.push(ownerDni.reason);
  if (!contract.verified && contract.reason) failures.push(contract.reason);
  if (!photos.verified && photos.reason) failures.push(photos.reason);
  if (!videoTour.verified && videoTour.reason) failures.push(videoTour.reason);
  if (!location.verified && location.reason) failures.push(location.reason);

  const score = aggregateScore(checks);
  const allBlocksOk =
    ownerDni.verified &&
    contract.verified &&
    photos.verified &&
    videoTour.verified &&
    location.verified;
  const verified = allBlocksOk && score >= LISTING_MIN_OVERALL_SCORE;

  if (!verified && failures.length === 0) {
    failures.push(
      'La publicación no alcanzó el umbral de confianza automático. Revisá la calidad de fotos y documentos.'
    );
  }

  logger.info('Verificación automática de listing', 'ListingVerification', {
    verified,
    score: Number(score.toFixed(3)),
    photos: `${photos.passed}/${photos.total}`,
  });

  return { verified, score, failures, checks };
}
