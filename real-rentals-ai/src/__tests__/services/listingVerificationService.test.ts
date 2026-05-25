import {
  verifyListingLocation,
  verifyVideoTour,
} from '../../services/listingVerification.rules';

function parseDataUrl(url: string): { mime: string; buffer: Buffer } | null {
  const match = url.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], 'base64') };
}

describe('listingVerificationService', () => {
  describe('verifyListingLocation', () => {
    it('acepta coordenadas dentro de Miami-Dade', () => {
      const r = verifyListingLocation(25.7617, -80.1918, 'Miami, FL');
      expect(r.verified).toBe(true);
    });

    it('rechaza coordenadas fuera de Miami-Dade', () => {
      const r = verifyListingLocation(40.7128, -74.006, 'New York');
      expect(r.verified).toBe(false);
      expect(r.reason).toMatch(/Miami-Dade/i);
    });

    it('acepta texto de ubicación con hint Miami sin coords', () => {
      const r = verifyListingLocation(null, null, 'Brickell, Miami FL');
      expect(r.verified).toBe(true);
    });
  });

  describe('verifyVideoTour', () => {
    it('rechaza video demasiado pequeño', () => {
      const tiny = Buffer.alloc(1000);
      const url = `data:video/mp4;base64,${tiny.toString('base64')}`;
      const r = verifyVideoTour(url);
      expect(r.verified).toBe(false);
    });

    it('acepta video con tamaño mínimo', () => {
      const buf = Buffer.alloc(250_000, 1);
      const url = `data:video/mp4;base64,${buf.toString('base64')}`;
      const r = verifyVideoTour(url);
      expect(r.verified).toBe(true);
    });
  });

  describe('parseDataUrl', () => {
    it('parsea data URL de imagen', () => {
      const buf = Buffer.from('test');
      const url = `data:image/png;base64,${buf.toString('base64')}`;
      const parsed = parseDataUrl(url);
      expect(parsed?.mime).toBe('image/png');
      expect(parsed?.buffer.length).toBe(4);
    });
  });
});
