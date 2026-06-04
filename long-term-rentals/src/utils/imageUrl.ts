/**
 * Optimización de URLs de imágenes para reducir el peso de descarga.
 *
 * Muchas fotos vienen de CDNs (Unsplash) pedidas a 1400px de ancho (~400KB c/u),
 * pero en las tarjetas del listado se muestran a ~400px. Pedir el tamaño justo
 * reduce el peso 4-5x y acelera muchísimo la carga, sobre todo en móvil.
 *
 * Unsplash y CDNs similares (imgix) aceptan los params ?w= y ?q= para
 * redimensionar y comprimir on-the-fly.
 */

const RESIZABLE_HOSTS = ['images.unsplash.com', 'imgix.net']

export function optimizedImageUrl(url: string | null | undefined, width: number, quality = 70): string {
  if (!url || typeof url !== 'string') return url || ''
  // No tocar data URIs ni rutas relativas/locales.
  if (url.startsWith('data:') || url.startsWith('/')) return url

  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    if (!RESIZABLE_HOSTS.some((h) => host.includes(h))) return url

    u.searchParams.set('w', String(Math.round(width)))
    u.searchParams.set('q', String(quality))
    u.searchParams.set('auto', 'format') // sirve webp/avif si el navegador lo soporta
    u.searchParams.set('fit', 'crop')
    return u.toString()
  } catch {
    return url
  }
}

/**
 * srcset para pantallas retina: 1x al ancho pedido, 2x al doble (tope 1600).
 * El navegador elige según la densidad de píxeles del dispositivo.
 */
export function optimizedSrcSet(url: string | null | undefined, width: number, quality = 70): string | undefined {
  if (!url || typeof url !== 'string') return undefined
  if (url.startsWith('data:') || url.startsWith('/')) return undefined
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    if (!RESIZABLE_HOSTS.some((h) => host.includes(h))) return undefined
  } catch {
    return undefined
  }
  const x1 = optimizedImageUrl(url, width, quality)
  const x2 = optimizedImageUrl(url, Math.min(width * 2, 1600), quality)
  return `${x1} 1x, ${x2} 2x`
}
