import {
  buildDuplicateListingPhotoUrls,
  buildSameSizeListingPhotoUrls,
  buildTinyListingPhotoUrls,
  buildValidListingPhotoUrls,
} from '../helpers/listingTestImages';

const mockRunOcr = jest.fn().mockResolvedValue('');

jest.mock('../../utils/documentVerification', () => {
  const actual = jest.requireActual('../../utils/documentVerification') as Record<string, unknown>;
  return {
    ...actual,
    runOcr: (...args: unknown[]) => mockRunOcr(...args),
    runOcrBatch: async (bufs: Buffer[]) => {
      const text = await mockRunOcr();
      return bufs.map(() => text);
    },
  };
});

import { verifyListingPhotos } from '../../services/listingVerificationService';
import { LISTING_MIN_PHOTOS } from '../../config/listingVerification.config';

describe('verifyListingPhotos — rechazo y aceptación real', () => {
  beforeEach(() => {
    mockRunOcr.mockReset();
    mockRunOcr.mockResolvedValue('');
  });

  it('rechaza menos de 8 fotos', async () => {
    const urls = buildValidListingPhotoUrls().slice(0, 5);
    const r = await verifyListingPhotos(urls);
    expect(r.verified).toBe(false);
    expect(r.reason).toMatch(new RegExp(`${LISTING_MIN_PHOTOS}`));
  });

  it('rechaza fotos con resolución demasiado baja (200×200)', async () => {
    const r = await verifyListingPhotos(buildTinyListingPhotoUrls());
    expect(r.verified).toBe(false);
    expect(r.passed).toBeLessThan(8);
    expect(r.reason).toMatch(/resolución|calidad|640/i);
  });

  it('rechaza 8 fotos idénticas (duplicados)', async () => {
    const r = await verifyListingPhotos(buildDuplicateListingPhotoUrls());
    expect(r.verified).toBe(false);
    expect(r.reason).toMatch(/repetidas|idénticas|duplicadas/i);
  });

  it('rechaza 8 fotos del mismo tamaño sin variedad de ambientes', async () => {
    const r = await verifyListingPhotos(buildSameSizeListingPhotoUrls());
    expect(r.verified).toBe(false);
    expect(r.reason).toMatch(/similares|distintos|ambientes/i);
  });

  it('rechaza cuando OCR detecta texto de documento de identidad en una foto', async () => {
    mockRunOcr.mockResolvedValue(
      'dni cedula identidad republica paraguay pasaporte documento nacional identificacion'
    );
    const r = await verifyListingPhotos(buildValidListingPhotoUrls());
    expect(r.verified).toBe(false);
    expect(r.reason).toMatch(/documento de identidad|identidad/i);
  });

  it('acepta 8 fotos válidas con dimensiones variadas y sin texto de DNI', async () => {
    const r = await verifyListingPhotos(buildValidListingPhotoUrls());
    expect(r.verified).toBe(true);
    expect(r.passed).toBe(8);
    expect(r.distinctDimensions).toBeGreaterThanOrEqual(3);
    expect(r.score).toBeGreaterThan(0.5);
  });

  it('rechaza data URL que no es imagen', async () => {
    const urls = [
      ...buildValidListingPhotoUrls().slice(0, 7),
      'data:text/plain;base64,dGVzdA=',
    ];
    const r = await verifyListingPhotos(urls);
    expect(r.verified).toBe(false);
    expect(r.passed).toBe(7);
    expect(r.reason).toMatch(/no es una imagen|válidas|pequeño|corrupto/i);
  });
});
