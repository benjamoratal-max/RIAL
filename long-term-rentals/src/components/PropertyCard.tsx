import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { MapPin, Star, Heart, Share2, Calendar, Home, Bed, Bath, GitCompare } from 'lucide-react'
import { Button, classNames } from './UI'
import { useFavorites } from './FavoritesSystem'
import { VerificationBadge } from './VerificationSystem'
import { toast } from 'react-hot-toast'
import type { PropertySummary } from '../data/properties'

interface PropertyCardProps {
  item: PropertySummary
  onOpen: () => void
  token?: string
  user?: any
  comparisonIds: number[]
  onAddToComparison?: (item: PropertySummary) => void
  onRemoveFromComparison?: (id: number) => void
}

function PropertyCardComponent({ item, onOpen, token, user, comparisonIds, onAddToComparison, onRemoveFromComparison }: PropertyCardProps) {
  const { t } = useTranslation()
  const { property, averageRating, reviewsCount, isAvailable } = item
  const { favorites, toggleFavorite } = useFavorites(token)
  const isFavorite = favorites.includes(property.id)
  const images = useMemo(
    () => (Array.isArray(property.images) ? property.images.filter(Boolean) : []),
    [property.images]
  )
  const [imageIndex, setImageIndex] = useState(0)

  useEffect(() => {
    setImageIndex(0)
  }, [property.id, images.length])

  const currentImage = images[imageIndex] || null

  const handleToggleComparison = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!comparisonIds.includes(property.id)) {
      if (comparisonIds.length < 4) {
        onAddToComparison?.(item)
        toast.success(t('propertyCard.addedToCompare'))
      } else {
        toast.error(t('propertyCard.maxCompare'))
      }
    } else {
      onRemoveFromComparison?.(property.id)
      toast.success(t('propertyCard.removedFromCompare'))
    }
  }, [comparisonIds, property.id, item, onAddToComparison, onRemoveFromComparison, t])

  const handleToggleFavorite = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    toggleFavorite(property.id)
  }, [toggleFavorite, property.id])

  const handleShare = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      const url =
        typeof window !== 'undefined'
          ? `${window.location.origin}${window.location.pathname}?property=${property.id}`
          : ''

      const copyToClipboard = (): boolean => {
        try {
          const textarea = document.createElement('textarea')
          textarea.value = url
          textarea.style.position = 'fixed'
          textarea.style.opacity = '0'
          document.body.appendChild(textarea)
          textarea.select()
          const ok = document.execCommand('copy')
          document.body.removeChild(textarea)
          return ok
        } catch {
          return false
        }
      }

      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url)
        } else {
          if (!copyToClipboard()) throw new Error('execCommand failed')
        }
        toast.success(t('propertyCard.linkCopied'))
      } catch {
        if (copyToClipboard()) {
          toast.success(t('propertyCard.linkCopied'))
        } else {
          toast.error(t('propertyCard.copyError'))
        }
      }
    },
    [property.id, t]
  )

  const handleImageError = useCallback(() => {
    setImageIndex((prev) => {
      if (prev >= images.length - 1) return prev
      return prev + 1
    })
  }, [images.length])

  const priceDisplay = useMemo(() => {
    const cur = property.currency || 'USD'
    try {
      return new Intl.NumberFormat(cur === 'EUR' ? 'es-ES' : 'en-US', {
        style: 'currency',
        currency: cur,
        maximumFractionDigits: 0,
      }).format(property.price)
    } catch {
      return `$${property.price?.toLocaleString?.() ?? property.price}`
    }
  }, [property.price, property.currency])

  return (
    <motion.div 
      className="group overflow-hidden rounded-2xl border border-rial-cream-dark/40 bg-white shadow-md transition-all duration-300 hover:shadow-xl dark:border-slate-700 dark:bg-slate-900"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      layout
    >
      <div className="relative aspect-[16/10] bg-gray-100 dark:bg-gray-700 overflow-hidden">
        {currentImage ? (
          <motion.img 
            src={currentImage}
            alt={property.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            whileHover={{ scale: 1.05 }}
            onError={handleImageError}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
            <Home className="w-12 h-12" />
          </div>
        )}
        
        {/* Botones de acción */}
        <div className="absolute top-3 right-3 flex space-x-2">
          {user && (
            <>
              <motion.button
                className="p-2 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleToggleFavorite}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'text-red-500 fill-current' : 'text-gray-600'}`} />
              </motion.button>
              <motion.button
                className="p-2 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleToggleComparison}
                title={t('propertyCard.addToCompare')}
              >
                <GitCompare className={`h-4 w-4 ${comparisonIds.includes(property.id) ? 'text-rial-gold' : 'text-gray-600'}`} />
              </motion.button>
            </>
          )}
          <motion.button
            type="button"
            className="p-2 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleShare}
            title={t('propertyCard.share')}
          >
            <Share2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </motion.button>
        </div>

        {/* Badges de disponibilidad y verificación */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <span className={classNames(
            'inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
            isAvailable 
              ? 'bg-rial-verified-soft text-rial-verified dark:bg-emerald-900/50 dark:text-emerald-200' 
              : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
          )}>
            {isAvailable ? t('propertyCard.available') : t('propertyCard.occupied')}
          </span>
          {property.verified && <VerificationBadge verified={property.verified} />}
        </div>
      </div>

      <div className="p-5 pt-4">
        <div className="mb-3 min-w-0">
          <p className="font-serif text-2xl font-medium leading-tight tracking-tight text-rial-navy dark:text-rial-cream">
            {priceDisplay}
            <span className="ml-1 align-baseline font-sans text-sm font-normal text-rial-muted dark:text-slate-400">
              {t('propertyCard.perMonth')}
            </span>
          </p>
          <div className="mt-2 flex items-start gap-1.5 text-sm text-rial-muted dark:text-slate-400">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
            <span className="line-clamp-2 leading-snug">{property.location}</span>
          </div>
          <h3 className="mt-2 line-clamp-2 font-sans text-xs font-semibold uppercase tracking-wide text-rial-muted dark:text-slate-500">
            {property.title}
          </h3>
        </div>
        
        <div className="mb-3 flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-400">
          {((property as any).broker?.isVerifiedBroker || (property as any).verified) && (
            <div className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
              <span className="font-semibold">
                {t('propertyDetail.listedByVerifiedBroker')}
              </span>
              {(property as any).broker?.name && (
                <span>· {(property as any).broker.name}</span>
              )}
              {(property as any).broker?.brokerageName && (
                <span>· {(property as any).broker.brokerageName}</span>
              )}
            </div>
          )}
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-rial-ink/80 dark:text-slate-300">
          <span className="flex items-center gap-1">
            <Home className="h-4 w-4 text-rial-navy opacity-80 dark:text-rial-gold" />
            {property.rooms ?? property.bedrooms} {t('propertyDetail.roomsShort')}
          </span>
          <span className="flex items-center gap-1">
            <Bed className="h-4 w-4 text-rial-navy opacity-80 dark:text-rial-gold" />
            {property.bedrooms} {t('propertyDetail.bedroomsShort')}
          </span>
          <span className="flex items-center gap-1">
            <Bath className="h-4 w-4 text-rial-navy opacity-80 dark:text-rial-gold" />
            {property.bathrooms} {t('propertyDetail.bathroomsShort')}
          </span>
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-1">
            <Star className="w-4 h-4 text-yellow-500 fill-current" />
            <span className="text-sm font-medium">{averageRating.toFixed(1)}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">({reviewsCount} {t('propertyCard.reviews')})</span>
          </div>
        </div>

        <Button 
          onClick={onOpen} 
          variant="outline" 
          className="w-full"
          icon={<Calendar className="w-4 h-4" />}
        >
          {t('propertyCard.viewDetail')}
        </Button>
      </div>
    </motion.div>
  )
}

// Memoizar el componente para evitar re-renders innecesarios
export const PropertyCard = React.memo(PropertyCardComponent, (prevProps, nextProps) => {
  // Solo re-renderizar si cambian estas props críticas
  return (
    prevProps.item.property.id === nextProps.item.property.id &&
    prevProps.item.averageRating === nextProps.item.averageRating &&
    prevProps.item.isAvailable === nextProps.item.isAvailable &&
    prevProps.item.reviewsCount === nextProps.item.reviewsCount &&
    prevProps.comparisonIds.length === nextProps.comparisonIds.length &&
    prevProps.comparisonIds.every((id, i) => id === nextProps.comparisonIds[i]) &&
    prevProps.token === nextProps.token &&
    prevProps.user?.id === nextProps.user?.id
  )
})

