import { describe, it, expect } from 'vitest'
import { optimizedImageUrl, optimizedSrcSet } from '../imageUrl'

describe('optimizedImageUrl', () => {
  it('reduce el ancho de imágenes de Unsplash', () => {
    const url = 'https://images.unsplash.com/photo-123?auto=format&fit=crop&w=1400&q=80'
    const out = optimizedImageUrl(url, 640, 70)
    expect(out).toContain('images.unsplash.com')
    expect(out).toContain('w=640')
    expect(out).toContain('q=70')
    expect(out).not.toContain('w=1400')
  })

  it('deja intactas las URLs de hosts no soportados', () => {
    const url = 'https://misitio.com/foto.jpg'
    expect(optimizedImageUrl(url, 640)).toBe(url)
  })

  it('no toca data URIs ni rutas relativas', () => {
    expect(optimizedImageUrl('data:image/png;base64,AAAA', 640)).toBe('data:image/png;base64,AAAA')
    expect(optimizedImageUrl('/local.png', 640)).toBe('/local.png')
  })

  it('maneja valores nulos sin romper', () => {
    expect(optimizedImageUrl(null, 640)).toBe('')
    expect(optimizedImageUrl(undefined, 640)).toBe('')
  })

  it('genera srcset 1x/2x para Unsplash y undefined para otros', () => {
    const url = 'https://images.unsplash.com/photo-123?w=1400'
    const srcset = optimizedSrcSet(url, 640)
    expect(srcset).toContain('1x')
    expect(srcset).toContain('2x')
    expect(optimizedSrcSet('https://otro.com/x.jpg', 640)).toBeUndefined()
  })
})
