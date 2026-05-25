import { PNG } from 'pngjs';
import { LISTING_PHOTO_MIN_BYTES } from '../../config/listingVerification.config';

/** Genera PNG con ruido para superar el mínimo de bytes y pasar image-size. */
export function createPngBuffer(width: number, height: number, seed = 0): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      const v = (x * 17 + y * 31 + seed * 97) % 256;
      png.data[idx] = v;
      png.data[idx + 1] = (v + 40) % 256;
      png.data[idx + 2] = (v + 80) % 256;
      png.data[idx + 3] = 255;
    }
  }
  let buf = PNG.sync.write(png);
  if (buf.length < LISTING_PHOTO_MIN_BYTES) {
    const extra = Buffer.alloc(LISTING_PHOTO_MIN_BYTES - buf.length + 100, 0xab);
    buf = Buffer.concat([buf, extra]);
  }
  return buf;
}

export function toImageDataUrl(buffer: Buffer, mime = 'image/png'): string {
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

/** 8 fotos válidas: resolución OK, ≥3 tamaños distintos, contenido distinto. */
export function buildValidListingPhotoUrls(): string[] {
  const sizes: [number, number][] = [
    [800, 600],
    [1024, 768],
    [1280, 720],
    [900, 675],
    [640, 480],
    [720, 540],
    [960, 640],
    [880, 660],
  ];
  return sizes.map(([w, h], i) => toImageDataUrl(createPngBuffer(w, h, i + 1)));
}

/** 8 fotos demasiado pequeñas (200×200). */
export function buildTinyListingPhotoUrls(): string[] {
  return Array.from({ length: 8 }, (_, i) =>
    toImageDataUrl(createPngBuffer(200, 200, i))
  );
}

/** 8 copias idénticas (duplicados). */
export function buildDuplicateListingPhotoUrls(): string[] {
  const one = toImageDataUrl(createPngBuffer(800, 600, 99));
  return Array.from({ length: 8 }, () => one);
}

/** 8 fotos grandes pero mismo tamaño (falla diversidad de dimensiones). */
export function buildSameSizeListingPhotoUrls(): string[] {
  return Array.from({ length: 8 }, (_, i) =>
    toImageDataUrl(createPngBuffer(800, 600, i + 50))
  );
}

export function buildValidVideoDataUrl(): string {
  const buf = Buffer.alloc(250_000, 0x01);
  return `data:video/mp4;base64,${buf.toString('base64')}`;
}

export function buildValidContractPdfDataUrl(): string {
  const legalBlock =
    'Residential Lease Agreement property Miami Florida landlord tenant premises dwelling ' +
    'monthly rent contract title deed arrendamiento alquiler rental agreement condominium\n';
  const body =
    '%PDF-1.4\n' +
    '1 0 obj<<>>endobj\n' +
    'trailer<<>>\n' +
    legalBlock.repeat(80);
  let buf = Buffer.from(body, 'utf8');
  const minContract = 8_500;
  if (buf.length < minContract) {
    buf = Buffer.concat([buf, Buffer.alloc(minContract - buf.length, 0x20)]);
  }
  return `data:application/pdf;base64,${buf.toString('base64')}`;
}

export function buildInvalidContractPdfDataUrl(): string {
  const body = '%PDF-1.4\n' + 'x'.repeat(500);
  return `data:application/pdf;base64,${Buffer.from(body).toString('base64')}`;
}
