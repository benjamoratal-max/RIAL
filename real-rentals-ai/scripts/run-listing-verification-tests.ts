/**
 * Prueba manual del verificador de publicaciones (sin Jest).
 * Ejecutar: npx ts-node scripts/run-listing-verification-tests.ts
 */
import {
  buildDuplicateListingPhotoUrls,
  buildInvalidContractPdfDataUrl,
  buildSameSizeListingPhotoUrls,
  buildTinyListingPhotoUrls,
  buildValidContractPdfDataUrl,
  buildValidListingPhotoUrls,
  buildValidVideoDataUrl,
} from '../src/__tests__/helpers/listingTestImages';
import { verifyListingPhotos, verifyContractOrTitle } from '../src/services/listingVerificationService';
import { verifyListingLocation, verifyVideoTour } from '../src/services/listingVerification.rules';

type Case = { name: string; run: () => Promise<boolean>; expectReject: boolean };

async function main() {
  const cases: Case[] = [
    {
      name: 'Ubicación Miami-Dade OK',
      expectReject: false,
      run: async () => verifyListingLocation(25.7617, -80.1918, 'Miami').verified,
    },
    {
      name: 'Ubicación NYC rechazada',
      expectReject: true,
      run: async () => !verifyListingLocation(40.71, -74.0, 'NY').verified,
    },
    {
      name: 'Video tour OK',
      expectReject: false,
      run: async () => verifyVideoTour(buildValidVideoDataUrl()).verified,
    },
    {
      name: 'Video tour muy pequeño rechazado',
      expectReject: true,
      run: async () => {
        const tiny = `data:video/mp4;base64,${Buffer.alloc(500).toString('base64')}`;
        return !verifyVideoTour(tiny).verified;
      },
    },
    {
      name: 'Contrato PDF válido',
      expectReject: false,
      run: async () => (await verifyContractOrTitle(buildValidContractPdfDataUrl())).verified,
    },
    {
      name: 'Contrato PDF sin términos legales rechazado',
      expectReject: true,
      run: async () => !(await verifyContractOrTitle(buildInvalidContractPdfDataUrl())).verified,
    },
    {
      name: '8 fotos válidas aceptadas',
      expectReject: false,
      run: async () => (await verifyListingPhotos(buildValidListingPhotoUrls())).verified,
    },
    {
      name: '8 fotos 200×200 rechazadas',
      expectReject: true,
      run: async () => !(await verifyListingPhotos(buildTinyListingPhotoUrls())).verified,
    },
    {
      name: '8 fotos idénticas rechazadas',
      expectReject: true,
      run: async () => !(await verifyListingPhotos(buildDuplicateListingPhotoUrls())).verified,
    },
    {
      name: '8 fotos mismo tamaño rechazadas (sin variedad)',
      expectReject: true,
      run: async () => !(await verifyListingPhotos(buildSameSizeListingPhotoUrls())).verified,
    },
    {
      name: 'Solo 5 fotos rechazadas',
      expectReject: true,
      run: async () =>
        !(await verifyListingPhotos(buildValidListingPhotoUrls().slice(0, 5))).verified,
    },
  ];

  console.log('\n=== Pruebas de verificación automática de publicaciones ===\n');
  let ok = 0;
  let fail = 0;

  for (const c of cases) {
    try {
      const pass = await c.run();
      const success = pass === true;
      if (success) {
        ok++;
        console.log(`✅ ${c.name}`);
      } else {
        fail++;
        console.log(`❌ ${c.name} — resultado inesperado`);
      }
    } catch (e) {
      fail++;
      console.log(`❌ ${c.name} — error:`, (e as Error).message);
    }
  }

  console.log(`\nResumen: ${ok} OK, ${fail} fallidas de ${cases.length}\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
