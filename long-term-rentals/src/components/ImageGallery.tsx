import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  Share2,
  Maximize2
} from 'lucide-react'
import { Button, classNames } from './UI'

interface ImageGalleryProps {
  images: string[]
  videos?: string[]
  title: string
  onClose?: () => void
  initialIndex?: number
}

interface LightboxProps {
  media: Array<{ type: 'image' | 'video', url: string, thumbnail?: string }>
  currentIndex: number
  onClose: () => void
  onNavigate: (index: number) => void
  title: string
}

export function ImageGallery({ images, videos = [], title, onClose, initialIndex = 0 }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [showLightbox, setShowLightbox] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Combinar imágenes y videos
  const media = [
    ...images.map(url => ({ type: 'image' as const, url })),
    ...videos.map(url => ({ type: 'video' as const, url, thumbnail: url.replace('.mp4', '.jpg') }))
  ]

  const handleImageClick = (index: number) => {
    setCurrentIndex(index)
    setShowLightbox(true)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!showLightbox) return
    
    switch (e.key) {
      case 'Escape':
        setShowLightbox(false)
        break
      case 'ArrowLeft':
        setCurrentIndex(prev => prev > 0 ? prev - 1 : media.length - 1)
        break
      case 'ArrowRight':
        setCurrentIndex(prev => prev < media.length - 1 ? prev + 1 : 0)
        break
    }
  }

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showLightbox])

  useEffect(() => {
    if (showLightbox) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
  }, [showLightbox])

  if (media.length === 0) {
    return (
      <div className="aspect-[16/10] bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center">
        <div className="text-gray-400 dark:text-gray-500 text-center">
          <div className="w-16 h-16 mx-auto mb-2 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
            <span className="text-2xl">📷</span>
          </div>
          <p className="text-sm">No hay imágenes disponibles</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Galería principal */}
      <div className="space-y-4">
        {/* Imagen principal */}
        <div className="relative aspect-[16/10] bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden group">
          {media[currentIndex].type === 'image' ? (
            <motion.img
              key={currentIndex}
              src={media[currentIndex].url}
              alt={`${title} - Imagen ${currentIndex + 1}`}
              loading="lazy"
              className="w-full h-full object-cover cursor-pointer"
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              onClick={() => handleImageClick(currentIndex)}
            />
          ) : (
            <div className="relative w-full h-full">
              <video
                src={media[currentIndex].url}
                poster={media[currentIndex].thumbnail}
                className="w-full h-full object-cover"
                controls
              />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <Play className="w-16 h-16 text-white" />
              </div>
            </div>
          )}

          {/* Overlay con controles */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
            <motion.div
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              initial={{ scale: 0.8 }}
              whileHover={{ scale: 1 }}
            >
              <Button
                variant="outline"
                onClick={() => handleImageClick(currentIndex)}
                icon={<ZoomIn className="w-5 h-5" />}
                className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm"
              >
                Ver más
              </Button>
            </motion.div>
          </div>

          {/* Contador */}
          <div className="absolute top-4 right-4 bg-black/50 text-white px-2 py-1 rounded-full text-sm backdrop-blur-sm">
            {currentIndex + 1} / {media.length}
          </div>

          {/* Botones de navegación */}
          {media.length > 1 && (
            <>
              <button
                onClick={() => setCurrentIndex(prev => prev > 0 ? prev - 1 : media.length - 1)}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-black/70 transition-all duration-200 opacity-0 group-hover:opacity-100"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentIndex(prev => prev < media.length - 1 ? prev + 1 : 0)}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-black/70 transition-all duration-200 opacity-0 group-hover:opacity-100"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Miniaturas */}
        {media.length > 1 && (
          <div className="grid grid-cols-5 gap-2">
            {media.map((item, index) => (
              <motion.div
                key={index}
                className={classNames(
                  "aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all duration-200",
                  index === currentIndex 
                    ? "border-blue-500 scale-105" 
                    : "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
                )}
                onClick={() => setCurrentIndex(index)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {item.type === 'image' ? (
                  <img
                    src={item.url}
                    alt={`Miniatura ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="relative w-full h-full">
                    <img
                      src={item.thumbnail || item.url}
                      alt={`Video ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <Play className="w-6 h-6 text-white" />
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {showLightbox && (
          <Lightbox
            media={media}
            currentIndex={currentIndex}
            onClose={() => setShowLightbox(false)}
            onNavigate={setCurrentIndex}
            title={title}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function Lightbox({ media, currentIndex, onClose, onNavigate, title }: LightboxProps) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const currentMedia = media[currentIndex]

  const handleZoom = (direction: 'in' | 'out') => {
    if (direction === 'in' && zoom < 3) {
      setZoom(zoom + 0.5)
    } else if (direction === 'out' && zoom > 0.5) {
      setZoom(zoom - 0.5)
    }
  }

  const resetView = () => {
    setZoom(1)
    setRotation(0)
  }

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const downloadMedia = () => {
    const link = document.createElement('a')
    link.href = currentMedia.url
    link.download = `${title}-${currentIndex + 1}`
    link.click()
  }

  const shareMedia = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: `Mira esta ${currentMedia.type === 'image' ? 'imagen' : 'video'} de ${title}`,
          url: currentMedia.url
        })
      } catch (error) {
        console.log('Error sharing:', error)
      }
    } else {
      // Fallback: copiar URL al portapapeles
      navigator.clipboard.writeText(currentMedia.url)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="relative w-full h-full flex items-center justify-center"
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Contenido principal */}
        <div className="relative max-w-full max-h-full">
          {currentMedia.type === 'image' ? (
            <motion.img
              key={currentIndex}
              src={currentMedia.url}
              alt={`${title} - Imagen ${currentIndex + 1}`}
              loading="eager"
              className="max-w-full max-h-full object-contain"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transition: 'transform 0.3s ease'
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            />
          ) : (
            <motion.video
              key={currentIndex}
              ref={videoRef}
              src={currentMedia.url}
              className="max-w-full max-h-full"
              controls
              autoPlay
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            />
          )}
        </div>

        {/* Controles superiores */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              icon={<X className="w-4 h-4" />}
              className="bg-black/50 text-white border-white/20 hover:bg-black/70"
            />
            <span className="text-white text-sm bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
              {currentIndex + 1} / {media.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {currentMedia.type === 'image' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleZoom('out')}
                  icon={<ZoomOut className="w-4 h-4" />}
                  className="bg-black/50 text-white border-white/20 hover:bg-black/70"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleZoom('in')}
                  icon={<ZoomIn className="w-4 h-4" />}
                  className="bg-black/50 text-white border-white/20 hover:bg-black/70"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetView}
                  icon={<RotateCcw className="w-4 h-4" />}
                  className="bg-black/50 text-white border-white/20 hover:bg-black/70"
                />
              </>
            )}

            {currentMedia.type === 'video' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={togglePlay}
                  icon={isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  className="bg-black/50 text-white border-white/20 hover:bg-black/70"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleMute}
                  icon={isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  className="bg-black/50 text-white border-white/20 hover:bg-black/70"
                />
              </>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={downloadMedia}
              icon={<Download className="w-4 h-4" />}
              className="bg-black/50 text-white border-white/20 hover:bg-black/70"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={shareMedia}
              icon={<Share2 className="w-4 h-4" />}
              className="bg-black/50 text-white border-white/20 hover:bg-black/70"
            />
          </div>
        </div>

        {/* Navegación */}
        {media.length > 1 && (
          <>
            <button
              onClick={() => onNavigate(currentIndex > 0 ? currentIndex - 1 : media.length - 1)}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-black/70 transition-all duration-200"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={() => onNavigate(currentIndex < media.length - 1 ? currentIndex + 1 : 0)}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-black/70 transition-all duration-200"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Miniaturas inferiores */}
        {media.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {media.map((item, index) => (
              <motion.div
                key={index}
                className={classNames(
                  "w-16 h-16 rounded-lg overflow-hidden cursor-pointer border-2 transition-all duration-200",
                  index === currentIndex 
                    ? "border-blue-500" 
                    : "border-white/30 hover:border-white/50"
                )}
                onClick={() => onNavigate(index)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                {item.type === 'image' ? (
                  <img
                    src={item.url}
                    alt={`Miniatura ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="relative w-full h-full">
                    <img
                      src={item.thumbnail || item.url}
                      alt={`Video ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <Play className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// Componente de vista 360° (placeholder)
export function View360({ images }: { images: string[] }) {
  const [currentAngle, setCurrentAngle] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setStartX(e.clientX)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    
    const deltaX = e.clientX - startX
    const angleChange = (deltaX / window.innerWidth) * 360
    setCurrentAngle(angleChange)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  if (images.length < 36) {
    return (
      <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="w-16 h-16 mx-auto mb-2 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
            <span className="text-2xl">🔄</span>
          </div>
          <p className="text-sm">Vista 360° no disponible</p>
          <p className="text-xs">Se requieren al menos 36 imágenes</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="w-full h-full flex items-center justify-center">
        <img
          src={images[Math.floor(currentAngle / 10) % images.length]}
          alt="Vista 360°"
          className="w-full h-full object-cover"
        />
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm backdrop-blur-sm">
        Vista 360° - Arrastra para rotar
      </div>
    </div>
  )
}
