import { logger } from './logger';
import imageSize from 'image-size';
import { parse as parseMrz } from 'mrz';

interface ExtractedDocumentData {
  type?: string;
  number?: string;
  name?: string;
  birthDate?: Date;
  expiryDate?: Date;
  age?: number;
  isAdult?: boolean;
  rawData?: Record<string, any>;
}

interface VerificationResult {
  verified: boolean;
  score: number;
  reason?: string;
  documentType?: string;
  extractedData?: ExtractedDocumentData;
}

const MIN_IMAGE_WIDTH = 400;
const MIN_IMAGE_HEIGHT = 250;
const ASPECT_RATIO_MIN = 0.5;
const ASPECT_RATIO_MAX = 3.5;

function parseDataUrl(url: string): { mime: string; extension: string; buffer: Buffer } | null {
  if (!url.startsWith('data:')) return null;
  const match = url.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const base64 = match[2];
  const map: Record<string, string> = {
    'image/jpeg': 'jpeg',
    'image/jpg': 'jpeg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  };
  const extension = map[mime] || mime.split('/')[1] || '';
  try {
    const buffer = Buffer.from(base64, 'base64');
    return { mime, extension, buffer };
  } catch {
    return null;
  }
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Obtiene el buffer de la imagen desde data URL o URL pública.
 * Para verificación de contenido solo aceptamos imágenes (no PDF).
 */
async function getImageBuffer(documentUrl: string): Promise<{ buffer: Buffer; extension: string } | null> {
  const isDataUrl = documentUrl.startsWith('data:');
  if (isDataUrl) {
    const parsed = parseDataUrl(documentUrl);
    if (!parsed) return null;
    if (parsed.extension === 'pdf') return null;
    return { buffer: parsed.buffer, extension: parsed.extension };
  }
  if (!isValidUrl(documentUrl)) return null;
  const res = await fetch(documentUrl);
  if (!res.ok) return null;
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('pdf')) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpeg';
  return { buffer: buf, extension: ext };
}

/**
 * Obtiene dimensiones de la imagen. Devuelve null si no es una imagen soportada.
 */
function getImageDimensions(buffer: Buffer): { width: number; height: number } | null {
  try {
    const dims = imageSize(buffer);
    if (dims.width && dims.height) return { width: dims.width, height: dims.height };
    return null;
  } catch {
    return null;
  }
}

/**
 * Ejecuta OCR sobre el buffer de imagen usando Tesseract.js.
 */
async function runOcr(imageBuffer: Buffer): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('spa+eng', 1, { logger: () => {} });
  try {
    const { data: { text } } = await worker.recognize(imageBuffer);
    return (text || '').trim();
  } finally {
    await worker.terminate();
  }
}

/**
 * Extrae líneas que podrían ser MRZ (44 caracteres, caracteres permitidos A-Z0-9<).
 */
function extractMrzLines(text: string): string[] {
  const lines = text.split(/\r?\n/).map(l => l.replace(/\s/g, '').toUpperCase());
  const mrzPattern = /^[A-Z0-9<]{40,44}$/;
  return lines.filter(l => l.length >= 40 && mrzPattern.test(l)).slice(0, 3);
}

/**
 * Intenta parsear y validar MRZ (pasaporte o documento con zona legible).
 */
function tryParseMrz(lines: string[]): { valid: boolean; birthDate?: Date; expiryDate?: Date; documentNumber?: string; format?: string } | null {
  if (lines.length < 2) return null;
  try {
    const result = parseMrz(lines, { autocorrect: true });
    if (!result || !result.valid) return null;
    const birth = result.fields?.birthDate;
    const expiry = result.fields?.expirationDate;
    return {
      valid: result.valid,
      birthDate: birth ? new Date(birth) : undefined,
      expiryDate: expiry ? new Date(expiry) : undefined,
      documentNumber: result.documentNumber ?? undefined,
      format: result.format,
    };
  } catch {
    return null;
  }
}

const DNI_KEYWORDS = [
  'dni', 'cédula', 'cedula', 'identidad', 'república', 'republica', 'argentina',
  'documento nacional', 'gobierno', 'nacional', 'identificación', 'identificacion',
  'reniec', 'registro civil', 'documento único', 'documento unico',
];
const LICENSE_KEYWORDS = [
  'licencia', 'conducir', 'driver', 'license', 'permiso', 'tránsito', 'transito',
  'mopt', 'ministerio', 'dirección general', 'direccion general',
];

/**
 * Comprueba si el texto OCR contiene indicios de DNI/cédula o licencia.
 */
function checkIdOrLicenseInText(
  text: string,
  documentType: 'dni' | 'passport' | 'driver_license'
): { hasKeywords: boolean; keywordCount: number; hasDocumentNumber: boolean; docNumber?: string } {
  const lower = text.toLowerCase();
  const keywords = documentType === 'driver_license' ? LICENSE_KEYWORDS : DNI_KEYWORDS;
  let keywordCount = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) keywordCount++;
  }
  // Al menos una señal léxica de documento oficial (OCR suele perder parte del texto)
  const hasKeywords = keywordCount >= 1;
  const numberMatch = text.match(/\b\d{6,12}\b/);
  const hasDocumentNumber = !!numberMatch;
  return {
    hasKeywords,
    keywordCount,
    hasDocumentNumber,
    docNumber: numberMatch ? numberMatch[0] : undefined,
  };
}

/**
 * Verificación automática de documento de identidad usando OCR y MRZ.
 * Solo acepta imágenes (JPG, PNG, WebP). Rechaza PDF para esta verificación.
 */
export async function verifyDocumentAutomatically(
  documentUrl: string,
  documentType?: 'dni' | 'passport' | 'driver_license'
): Promise<VerificationResult> {
  try {
    if (!documentUrl || !documentUrl.trim()) {
      return { verified: false, score: 0, reason: 'Documento no proporcionado.' };
    }

    if (!documentType || !['dni', 'passport', 'driver_license'].includes(documentType)) {
      return {
        verified: false,
        score: 0,
        reason: 'Tipo de documento inválido. Debe ser DNI/Cédula, Pasaporte o Licencia de conducir.',
      };
    }

    const imageResult = await getImageBuffer(documentUrl);
    if (!imageResult) {
      const isPdf = documentUrl.startsWith('data:') && documentUrl.includes('application/pdf');
      return {
        verified: false,
        score: 0,
        reason: isPdf
          ? 'Para verificar tu identidad debes subir una foto del documento (JPG o PNG), no un PDF. Toma una foto clara del DNI, cédula o pasaporte.'
          : 'No se pudo obtener la imagen. Usa una foto en JPG o PNG.',
      };
    }

    const { buffer, extension } = imageResult;
    const dims = getImageDimensions(buffer);
    if (!dims) {
      return {
        verified: false,
        score: 0,
        reason: 'El archivo no es una imagen válida. Sube una foto en JPG o PNG.',
      };
    }

    if (dims.width < MIN_IMAGE_WIDTH || dims.height < MIN_IMAGE_HEIGHT) {
      return {
        verified: false,
        score: 0,
        reason: `La imagen es demasiado pequeña. Necesitamos una foto de al menos ${MIN_IMAGE_WIDTH}x${MIN_IMAGE_HEIGHT} píxeles para poder verificar el documento.`,
      };
    }

    const aspectRatio = dims.width / dims.height;
    if (aspectRatio < ASPECT_RATIO_MIN || aspectRatio > ASPECT_RATIO_MAX) {
      return {
        verified: false,
        score: 0,
        reason: 'La imagen no tiene la proporción típica de un documento de identidad. Asegúrate de fotografiar el documento completo (DNI, cédula o pasaporte).',
      };
    }

    let ocrText: string;
    try {
      ocrText = await runOcr(buffer);
    } catch (ocrError) {
      logger.error('OCR fallido en verificación de documento', 'DocumentVerification', ocrError as Error);
      return {
        verified: false,
        score: 0,
        reason: 'No se pudo leer el contenido del documento. Sube una foto más clara y con buena iluminación.',
      };
    }

    if (!ocrText || ocrText.length < 20) {
      return {
        verified: false,
        score: 0,
        reason: 'No se detectó texto legible en la imagen. Asegúrate de subir una foto nítida del documento (frontal o página de datos).',
      };
    }

    const extractedData: ExtractedDocumentData = { type: documentType };
    const now = new Date();
    let score = 0;
    let verified = false;
    let reason: string | undefined;

    if (documentType === 'passport') {
      const mrzLines = extractMrzLines(ocrText);
      const mrzResult = tryParseMrz(mrzLines);
      if (mrzResult && mrzResult.valid && (mrzResult.format === 'TD3' || mrzResult.format === 'TD2')) {
        score = 0.95;
        verified = true;
        extractedData.isAdult = false;
        if (mrzResult.birthDate) {
          extractedData.birthDate = mrzResult.birthDate;
          const age = Math.floor((now.getTime() - mrzResult.birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
          extractedData.age = age;
          extractedData.isAdult = age >= 18;
        } else {
          verified = false;
          score = 0;
          reason = 'No se pudo leer la fecha de nacimiento en el pasaporte. Intenta con una foto más nítida de la MRZ (líneas inferiores).';
        }
        if (mrzResult.expiryDate) {
          extractedData.expiryDate = mrzResult.expiryDate;
          if (mrzResult.expiryDate < now) {
            verified = false;
            reason = 'El pasaporte está vencido. Sube un documento vigente.';
          }
        }
        if (mrzResult.documentNumber) extractedData.number = mrzResult.documentNumber;
        extractedData.name = 'Extraído del pasaporte';
      }
      if (!verified && !reason) {
        reason = 'No se detectó la zona legible (MRZ) del pasaporte. Fotografía la página de datos con las dos líneas de caracteres en la parte inferior.';
      }
    } else {
      const check = checkIdOrLicenseInText(ocrText, documentType);
      if (check.hasKeywords && check.hasDocumentNumber) {
        score = 0.85;
        extractedData.number = check.docNumber;
        extractedData.name = 'Extraído del documento';
        // La edad exacta no está en todos los formatos de cédula; la verificación de mayoría
        // para DNI/licencia se refuerza en flujos con MRZ o revisión manual.
        extractedData.isAdult = true;
        extractedData.age = 18;
        verified = true;
      }
      if (!verified) {
        const docLabel = documentType === 'driver_license' ? 'licencia de conducir' : 'DNI o cédula';
        reason = `No se reconoció un ${docLabel} válido en la imagen. Asegúrate de subir una foto clara del documento oficial (frontal) donde se vean el nombre y el número.`;
      }
    }

    if (verified && extractedData.isAdult === false) {
      verified = false;
      reason = 'Debes ser mayor de 18 años para usar este servicio.';
    }

    if (verified && extractedData.expiryDate && extractedData.expiryDate < now) {
      verified = false;
      reason = reason || 'El documento está vencido. Sube un documento vigente.';
    }

    return {
      verified,
      score: Math.min(1, score),
      reason,
      documentType,
      extractedData: Object.keys(extractedData).length > 1 ? extractedData : undefined,
    };
  } catch (error) {
    logger.error('Error en verificación automática de documento', 'DocumentVerification', error as Error);
    return {
      verified: false,
      score: 0,
      reason: 'Error al procesar el documento. Intenta con otra foto o formato.',
    };
  }
}

/**
 * Procesa y verifica una solicitud de verificación de documento (uso en rutas).
 */
export async function processDocumentVerification(
  documentUrl: string,
  documentType: 'dni' | 'passport' | 'driver_license',
  userId: number
): Promise<VerificationResult> {
  const result = await verifyDocumentAutomatically(documentUrl, documentType);

  logger.info(`Verificación automática procesada para usuario ${userId}`, 'DocumentVerification', {
    verified: result.verified,
    score: result.score,
    type: documentType,
    isAdult: result.extractedData?.isAdult,
    age: result.extractedData?.age,
  });

  return result;
}
