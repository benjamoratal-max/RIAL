import {
  buildInvalidContractPdfDataUrl,
  buildValidContractPdfDataUrl,
  buildValidListingPhotoUrls,
  buildValidVideoDataUrl,
  buildDuplicateListingPhotoUrls,
  buildTinyListingPhotoUrls,
} from '../helpers/listingTestImages';

const mockVerifyDni = jest.fn();
const mockRunOcr = jest.fn().mockResolvedValue('');

jest.mock('../../utils/documentVerification', () => {
  const actual = jest.requireActual('../../utils/documentVerification') as Record<string, unknown>;
  return {
    ...actual,
    runOcr: (...args: unknown[]) => mockRunOcr(...args),
    verifyDocumentAutomatically: (...args: unknown[]) => mockVerifyDni(...args),
  };
});

import { verifyListingForPublish } from '../../services/listingVerificationService';

const baseInput = () => ({
  images: buildValidListingPhotoUrls(),
  ownerDniDocumentUrl: 'data:image/png;base64,abc',
  contractOrTitleUrl: buildValidContractPdfDataUrl(),
  videoTourUrl: buildValidVideoDataUrl(),
  latitude: 25.7617,
  longitude: -80.1918,
  location: 'Brickell, Miami FL',
});

describe('verifyListingForPublish — flujo completo', () => {
  beforeEach(() => {
    mockVerifyDni.mockResolvedValue({ verified: true, score: 0.9 });
    mockRunOcr.mockResolvedValue('');
  });

  it('aprueba publicación cuando todos los bloques pasan', async () => {
    const r = await verifyListingForPublish(baseInput());
    expect(r.verified).toBe(true);
    expect(r.failures).toHaveLength(0);
    expect(r.checks.photos.verified).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0.72);
  });

  it('rechaza publicación con fotos inválidas (baja resolución)', async () => {
    const r = await verifyListingForPublish({
      ...baseInput(),
      images: buildTinyListingPhotoUrls(),
    });
    expect(r.verified).toBe(false);
    expect(r.checks.photos.verified).toBe(false);
    expect(r.failures.some((f) => /foto|resolución|calidad|640/i.test(f))).toBe(true);
  });

  it('rechaza publicación con fotos duplicadas', async () => {
    const r = await verifyListingForPublish({
      ...baseInput(),
      images: buildDuplicateListingPhotoUrls(),
    });
    expect(r.verified).toBe(false);
    expect(r.checks.photos.verified).toBe(false);
    expect(r.failures.some((f) => /repetidas|idénticas/i.test(f))).toBe(true);
  });

  it('rechaza publicación con contrato PDF inválido', async () => {
    const r = await verifyListingForPublish({
      ...baseInput(),
      contractOrTitleUrl: buildInvalidContractPdfDataUrl(),
    });
    expect(r.verified).toBe(false);
    expect(r.checks.contract.verified).toBe(false);
  });

  it('rechaza publicación fuera de Miami-Dade', async () => {
    const r = await verifyListingForPublish({
      ...baseInput(),
      latitude: 40.7128,
      longitude: -74.006,
      location: 'New York',
    });
    expect(r.verified).toBe(false);
    expect(r.checks.location.verified).toBe(false);
  });

  it('rechaza cuando el DNI no pasa verificación', async () => {
    mockVerifyDni.mockResolvedValue({
      verified: false,
      score: 0,
      reason: 'No se reconoció un dni válido',
    });
    const r = await verifyListingForPublish(baseInput());
    expect(r.verified).toBe(false);
    expect(r.checks.ownerDni.verified).toBe(false);
  });
});
