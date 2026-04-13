import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause } from 'lucide-react'

const SLIDE_DURATION_MS = 4500
const TICK_MS = 40

/** Ease-in-out: arranque y llegada suaves, no lineal robótico */
function easeInOut(t: number): number {
  return t * t * (3 - 2 * t)
}

/**
 * Por cada escena define un tipo de movimiento distinto en primera persona:
 * - Entrar al cuarto: zoom marcado, poco pan
 * - Mirar a un lado: poco zoom, pan horizontal fuerte
 * - Recorrer vista: pan diagonal + zoom medio
 * - Avanzar por pasillo: pan horizontal muy marcado
 * Los valores de pan son fracción del ancho/alto (0.18 = 18% de movimiento).
 */
function getMotionForIndex(i: number): { scaleEnd: number; panX: number; panY: number } {
  const motions = [
    { scaleEnd: 1.22, panX: 0.06, panY: 0.03 },   // Entrar: avanzar hacia la habitación
    { scaleEnd: 1.08, panX: -0.18, panY: -0.04 }, // Mirar a la izquierda
    { scaleEnd: 1.15, panX: 0.12, panY: 0.08 },   // Diagonal: pasar y mirar
    { scaleEnd: 1.06, panX: 0.2, panY: 0 },       // Girar a la derecha (pasillo)
    { scaleEnd: 1.18, panX: -0.1, panY: 0.06 },    // Entrar y mirar
    { scaleEnd: 1.04, panX: 0, panY: -0.14 },     // Mirar hacia arriba (doble altura)
    { scaleEnd: 1.12, panX: -0.14, panY: -0.06 }, // Recorrer vista
    { scaleEnd: 1.1, panX: 0.16, panY: 0.05 },    // Otro ángulo
  ]
  return motions[i % motions.length]
}

interface PhotoTourProps {
  images: string[]
  title?: string
  className?: string
}

/**
 * Recorrido en primera persona: cada foto con un movimiento distinto
 * (entrar, girar, mirar arriba, pasar) para simular caminar por la propiedad.
 */
export function PhotoTour({ images, title, className = '' }: PhotoTourProps) {
  const [index, setIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [progress, setProgress] = useState(0)
  const slideStartTime = useRef(Date.now())

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % Math.max(1, images.length))
    setProgress(0)
    slideStartTime.current = Date.now()
  }, [images.length])

  useEffect(() => {
    if (!isPlaying || !images.length) return
    const timer = setInterval(() => {
      const elapsed = Date.now() - slideStartTime.current
      const p = Math.min(1, elapsed / SLIDE_DURATION_MS)
      setProgress(p)
      if (p >= 1) next()
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [isPlaying, images.length, next])

  useEffect(() => {
    if (isPlaying) {
      slideStartTime.current = Date.now() - progress * SLIDE_DURATION_MS
    }
  }, [isPlaying])

  const goToSlide = useCallback((i: number) => {
    setIndex(i)
    setProgress(0)
    slideStartTime.current = Date.now()
    setIsPlaying(true)
  }, [])

  if (!images?.length) return null

  const currentImage = images[index % images.length]
  const { scaleEnd, panX, panY } = getMotionForIndex(index)
  const t = easeInOut(progress)
  const scale = 1 + (scaleEnd - 1) * t
  const tx = panX * t * 100
  const ty = panY * t * 100

  return (
    <div className={`rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-600 bg-black ${className}`}>
      <div className="relative w-full aspect-video overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={index}
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
          >
            <div
              className="absolute w-full h-full will-change-transform"
              style={{
                transform: `scale(${scale}) translate(${tx}%, ${ty}%)`,
              }}
            >
              <img
                src={currentImage}
                alt={title ? `${title} - Recorrido ${index + 1}` : `Recorrido ${index + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
                draggable={false}
              />
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition-colors"
            aria-label={isPlaying ? 'Pausar recorrido' : 'Reproducir recorrido'}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>

          <div className="flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goToSlide(i)}
                className={`
                  h-1.5 rounded-full transition-all duration-300
                  ${i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/70'}
                `}
                aria-label={`Ir a escena ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
