import {
  buildInvalidContractPdfDataUrl,
  buildValidContractPdfDataUrl,
  createPngBuffer,
  toImageDataUrl,
} from '../helpers/listingTestImages';

jest.mock('../../utils/documentVerification', () => {
  const actual = jest.requireActual('../../utils/documentVerification') as Record<string, unknown>;
  return {
    ...actual,
    runOcr: jest.fn().mockResolvedValue(''),
  };
});

import { verifyContractOrTitle } from '../../services/listingVerificationService';

describe('verifyContractOrTitle', () => {
  it('rechaza PDF sin términos de contrato/título', async () => {
    const r = await verifyContractOrTitle(buildInvalidContractPdfDataUrl());
    expect(r.verified).toBe(false);
    expect(r.reason).toMatch(/contrato|título|legal/i);
  });

  it('acepta PDF con palabras legales de arrendamiento', async () => {
    const r = await verifyContractOrTitle(buildValidContractPdfDataUrl());
    expect(r.verified).toBe(true);
  });

  it('rechaza imagen de contrato demasiado pequeña', async () => {
    const tiny = toImageDataUrl(createPngBuffer(100, 80, 1));
    const r = await verifyContractOrTitle(tiny);
    expect(r.verified).toBe(false);
    expect(r.reason).toMatch(/pequeña|pequeño/i);
  });
});
