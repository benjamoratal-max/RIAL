/**
 * Reduce tamaño de la foto de documento antes de enviarla (JPEG base64).
 * Mantiene legibilidad para OCR y evita timeouts / límites de proxy.
 */
export async function compressIdentityImageToJpegDataUrl(
  file: File,
  options?: { maxLongEdge?: number; quality?: number }
): Promise<string> {
  const maxLongEdge = options?.maxLongEdge ?? 1400
  const quality = options?.quality ?? 0.78

  const bitmap = await createImageBitmap(file)
  try {
    const longEdge = Math.max(bitmap.width, bitmap.height)
    const scale = longEdge > maxLongEdge ? maxLongEdge / longEdge : 1
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas no disponible')
    ctx.drawImage(bitmap, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    bitmap.close()
  }
}
