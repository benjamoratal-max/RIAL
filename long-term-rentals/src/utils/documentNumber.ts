/** Normaliza número de documento para comparar (cédula/DNI/pasaporte). */
export function normalizeDocumentNumber(value: string): string {
  return String(value || '')
    .trim()
    .replace(/[\s.\-_/]/g, '')
    .toUpperCase()
}
