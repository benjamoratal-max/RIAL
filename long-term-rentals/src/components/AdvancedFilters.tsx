import React, { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Filter, 
  MapPin, 
  DollarSign, 
  Bed, 
  Bath, 
  Home, 
  Wifi, 
  Car, 
  Calendar,
  X,
  Search,
  SlidersHorizontal,
  Map,
  Star,
  Users
} from 'lucide-react'
import { Button, Input, classNames } from './UI'

interface FilterOptions {
  location: string
  minPrice: string
  maxPrice: string
  bedrooms: string
  rooms: string
  bathrooms: string
  propertyType: string
  amenities: string[]
  availableFrom: string
  availableTo: string
  sort: string
  rating: string
  maxGuests: string
  query: string // Búsqueda semántica
  verified: boolean // Solo propiedades verificadas
  petsAllowed: boolean
  furnished: boolean
  parking: boolean
  wifi: boolean
  airConditioning: boolean
  heating: boolean
  balcony: boolean
  elevator: boolean
  gym: boolean
  pool: boolean
}

interface AdvancedFiltersProps {
  filters: FilterOptions
  setFilters: (filters: FilterOptions) => void
  onSearch: () => void
  onReset: () => void
  showMap: boolean
  onToggleMap: () => void
}

const PROPERTY_TYPE_KEYS: { value: string; key: string }[] = [
  { value: '', key: 'allTypes' },
  { value: 'apartment', key: 'apartment' },
  { value: 'house', key: 'house' },
  { value: 'studio', key: 'studio' },
  { value: 'loft', key: 'loft' },
  { value: 'penthouse', key: 'penthouse' },
  { value: 'villa', key: 'villa' },
  { value: 'townhouse', key: 'townhouse' }
]

const SORT_OPTION_KEYS: { value: string; key: string }[] = [
  { value: '', key: 'sortRelevance' },
  { value: 'price_asc', key: 'sortPriceAsc' },
  { value: 'price_desc', key: 'sortPriceDesc' },
  { value: 'rating_desc', key: 'sortRating' },
  { value: 'newest', key: 'sortNewest' },
  { value: 'oldest', key: 'sortOldest' }
]

const RATING_OPTION_KEYS: { value: string; key: string }[] = [
  { value: '', key: 'ratingAny' },
  { value: '4.5', key: 'rating45' },
  { value: '4.0', key: 'rating40' },
  { value: '3.5', key: 'rating35' },
  { value: '3.0', key: 'rating30' }
]

const AMENITY_KEYS = [
  'pool', 'gym', 'balcony', 'terrace', 'parking', 'wifi', 'airConditioning', 'heating',
  'elevator', 'furnished', 'petFriendly'
]

/** Chips de búsqueda rápida: key para i18n, query opcional, o solo filtro (verified) */
const QUICK_SEARCH_CHIPS: { key: string; query?: string; verified?: boolean }[] = [
  { key: 'pool', query: 'pileta' },
  { key: 'petFriendly', query: 'mascotas' },
  { key: 'furnished', query: 'amueblado' },
  { key: 'parking', query: 'cochera' },
  { key: 'puertoMadero', query: 'Puerto Madero' },
  { key: 'palermo', query: 'Palermo' },
  { key: 'recoleta', query: 'Recoleta' },
  { key: 'twoRooms', query: '2 ambientes' },
  { key: 'threeRooms', query: '3 ambientes' },
  { key: 'studio', query: 'monoambiente' },
  { key: 'gym', query: 'gimnasio' },
  { key: 'verified', verified: true }
]

export function AdvancedFilters({ 
  filters, 
  setFilters, 
  onSearch, 
  onReset, 
  showMap, 
  onToggleMap 
}: AdvancedFiltersProps) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)
  // Store amenity keys in filters; display translated labels
  const AMENITIES = AMENITY_KEYS

  // Contar filtros activos - optimizado con useMemo
  const activeFilters = useMemo(() => {
    let count = 0
    if (filters.query) count++
    if (filters.location) count++
    if (filters.minPrice) count++
    if (filters.maxPrice) count++
    if (filters.bedrooms) count++
    if (filters.rooms) count++
    if (filters.bathrooms) count++
    if (filters.propertyType) count++
    if (filters.availableFrom) count++
    if (filters.availableTo) count++
    if (filters.rating) count++
    if (filters.maxGuests) count++
    if (filters.verified) count++
    if (filters.petsAllowed) count++
    if (filters.furnished) count++
    if (filters.parking) count++
    if (filters.wifi) count++
    if (filters.airConditioning) count++
    if (filters.heating) count++
    if (filters.balcony) count++
    if (filters.elevator) count++
    if (filters.gym) count++
    if (filters.pool) count++
    if (filters.amenities?.length) count++
    return count
  }, [filters])

  const updateFilter = (key: keyof FilterOptions, value: any) => {
    setFilters({ ...filters, [key]: value })
  }

  const toggleAmenity = (amenity: keyof FilterOptions) => {
    setFilters({ ...filters, [amenity]: !filters[amenity] })
  }

  const toggleAmenitiesFilter = (tag: string) => {
    const current = filters.amenities || []
    const exists = current.includes(tag)
    const updated = exists ? current.filter((item) => item !== tag) : [...current, tag]
    setFilters({ ...filters, amenities: updated })
  }

  const resetFilters = () => {
    const defaultFilters: FilterOptions = {
      location: '',
      minPrice: '',
      maxPrice: '',
      bedrooms: '',
      rooms: '',
      bathrooms: '',
      propertyType: '',
      amenities: [],
      availableFrom: '',
      availableTo: '',
      sort: '',
      rating: '',
      maxGuests: '',
      query: '',
      verified: false,
      petsAllowed: false,
      furnished: false,
      parking: false,
      wifi: false,
      airConditioning: false,
      heating: false,
      balcony: false,
      elevator: false,
      gym: false,
      pool: false
    }
    setFilters(defaultFilters)
    onReset()
  }

  return (
    <motion.div 
      className="rounded-2xl border border-rial-cream-dark/50 bg-white p-6 shadow-md dark:border-slate-700 dark:bg-slate-900/95"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header con botones principales */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-rial-navy dark:text-rial-gold" />
            <h3 className="text-lg font-semibold text-rial-navy dark:text-rial-cream">{t('filtersAdvanced.title')}</h3>
            {activeFilters > 0 && (
              <motion.span 
                className="rounded-full bg-rial-gold px-2 py-1 text-xs font-semibold text-rial-navy"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              >
                {activeFilters}
              </motion.span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={onToggleMap}
            icon={showMap ? <Search className="w-4 h-4" /> : <Map className="w-4 h-4" />}
          >
            {showMap ? t('filtersAdvanced.list') : t('filtersAdvanced.map')}
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            icon={isExpanded ? <X className="w-4 h-4" /> : <SlidersHorizontal className="w-4 h-4" />}
          >
            {isExpanded ? t('filtersAdvanced.less') : t('filtersAdvanced.more')}
          </Button>
        </div>
      </div>

      {/* Búsqueda principal: texto libre con ejemplos */}
      <div className="mb-4">
        <label className="mb-1.5 block text-sm font-medium text-rial-ink dark:text-slate-200">
          {t('filtersAdvanced.searchLabel')}
        </label>
        <Input 
          placeholder={t('filtersAdvanced.searchPlaceholder')} 
          value={filters.query || ''} 
          onChange={(value) => updateFilter('query', value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          icon={<Search className="w-4 h-4" />}
          className="text-base"
        />
        <p className="mt-1.5 text-xs text-rial-muted dark:text-slate-400">
          {t('filtersAdvanced.searchHint')}
        </p>
      </div>

      {/* Chips de búsqueda rápida */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="mr-1 self-center text-xs text-rial-muted dark:text-slate-400">{t('filtersAdvanced.quickSearch')}</span>
        {QUICK_SEARCH_CHIPS.map(({ key, query, verified }) => {
          const label = t(`filtersAdvanced.quickChip_${key}`)
          const isActive = verified ? filters.verified : (
            (filters.query || '').toLowerCase() === (query || '').toLowerCase() ||
            (query && (filters.query || '').toLowerCase().split(/\s+/).includes((query || '').toLowerCase()))
          )
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (verified != null) {
                  const newVerified = isActive ? false : true
                  setFilters({ ...filters, verified: newVerified })
                  if (newVerified) onSearch()
                } else {
                  const newQuery = isActive ? '' : (query || '')
                  setFilters({ ...filters, query: newQuery })
                  if (newQuery) onSearch()
                }
              }}
              className={classNames(
                'rounded-full px-3 py-1.5 text-sm font-medium transition-all',
                isActive
                  ? 'border border-rial-navy bg-rial-navy text-rial-cream shadow-sm dark:bg-rial-navy dark:text-rial-cream'
                  : 'border border-rial-cream-dark/40 bg-white text-rial-ink hover:bg-rial-cream-dark/35 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              )}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Filtros básicos siempre visibles */}
      <div className="grid md:grid-cols-5 gap-4 mb-6">
        <Input 
          placeholder={t('filtersAdvanced.location')} 
          value={filters.location} 
          onChange={(value) => updateFilter('location', value)}
          icon={<MapPin className="w-4 h-4" />}
        />
        <Input 
          type="number"
          placeholder={t('filtersAdvanced.minPrice')} 
          value={filters.minPrice} 
          onChange={(value) => updateFilter('minPrice', value)}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <Input 
          type="number"
          placeholder={t('filtersAdvanced.maxPrice')} 
          value={filters.maxPrice} 
          onChange={(value) => updateFilter('maxPrice', value)}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <select 
          className="w-full rounded-xl border border-rial-cream-dark/50 bg-white px-3 py-2 text-rial-ink focus:border-transparent focus:outline-none focus:ring-2 focus:ring-rial-gold dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          value={filters.sort} 
          onChange={e => updateFilter('sort', e.target.value)}
        >
          {SORT_OPTION_KEYS.map(option => (
            <option key={option.value} value={option.value}>{t(`filtersAdvanced.${option.key}`)}</option>
          ))}
        </select>
      </div>

      {/* Filtros avanzados expandibles */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Características básicas */}
            <div>
              <h4 className="mb-3 font-medium text-rial-navy dark:text-rial-cream">{t('filtersAdvanced.characteristics')}</h4>
              <div className="grid md:grid-cols-5 gap-4">
                <select 
                  className="w-full rounded-xl border border-rial-cream-dark/50 bg-white px-3 py-2 text-rial-ink focus:border-transparent focus:outline-none focus:ring-2 focus:ring-rial-gold dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={filters.bedrooms} 
                  onChange={e => updateFilter('bedrooms', e.target.value)}
                >
                  <option value="">{t('filtersAdvanced.bedroomsPlaceholder')}</option>
                  <option value="1">{t('filtersAdvanced.bedroom1')}</option>
                  <option value="2">{t('filtersAdvanced.bedroom2')}</option>
                  <option value="3">{t('filtersAdvanced.bedroom3')}</option>
                  <option value="4">{t('filtersAdvanced.bedroom4')}</option>
                </select>
                
                <select 
                  className="w-full rounded-xl border border-rial-cream-dark/50 bg-white px-3 py-2 text-rial-ink focus:border-transparent focus:outline-none focus:ring-2 focus:ring-rial-gold dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={filters.rooms} 
                  onChange={e => updateFilter('rooms', e.target.value)}
                >
                  <option value="">{t('filtersAdvanced.roomsPlaceholder')}</option>
                  <option value="1">{t('filtersAdvanced.room1')}</option>
                  <option value="2">{t('filtersAdvanced.room2')}</option>
                  <option value="3">{t('filtersAdvanced.room3')}</option>
                  <option value="4">{t('filtersAdvanced.room4')}</option>
                </select>
                
                <select 
                  className="w-full rounded-xl border border-rial-cream-dark/50 bg-white px-3 py-2 text-rial-ink focus:border-transparent focus:outline-none focus:ring-2 focus:ring-rial-gold dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={filters.bathrooms} 
                  onChange={e => updateFilter('bathrooms', e.target.value)}
                >
                  <option value="">{t('filtersAdvanced.bathroomsPlaceholder')}</option>
                  <option value="1">{t('filtersAdvanced.bathroom1')}</option>
                  <option value="2">{t('filtersAdvanced.bathroom2')}</option>
                  <option value="3">{t('filtersAdvanced.bathroom3')}</option>
                </select>
                
                <select 
                  className="w-full rounded-xl border border-rial-cream-dark/50 bg-white px-3 py-2 text-rial-ink focus:border-transparent focus:outline-none focus:ring-2 focus:ring-rial-gold dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={filters.propertyType} 
                  onChange={e => updateFilter('propertyType', e.target.value)}
                >
                  {PROPERTY_TYPE_KEYS.map(type => (
                    <option key={type.value} value={type.value}>{t(`filtersAdvanced.${type.key}`)}</option>
                  ))}
                </select>
                
                <select 
                  className="w-full rounded-xl border border-rial-cream-dark/50 bg-white px-3 py-2 text-rial-ink focus:border-transparent focus:outline-none focus:ring-2 focus:ring-rial-gold dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={filters.rating} 
                  onChange={e => updateFilter('rating', e.target.value)}
                >
                  {RATING_OPTION_KEYS.map(rating => (
                    <option key={rating.value} value={rating.value}>{t(`filtersAdvanced.${rating.key}`)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Fechas de disponibilidad */}
            <div>
              <h4 className="mb-3 font-medium text-rial-navy dark:text-rial-cream">{t('filtersAdvanced.availability')}</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <Input 
                  type="date"
                  placeholder={t('filtersAdvanced.availableFrom')} 
                  value={filters.availableFrom} 
                  onChange={(value) => updateFilter('availableFrom', value)}
                  icon={<Calendar className="w-4 h-4" />}
                />
                <Input 
                  type="date"
                  placeholder={t('filtersAdvanced.availableTo')} 
                  value={filters.availableTo} 
                  onChange={(value) => updateFilter('availableTo', value)}
                  icon={<Calendar className="w-4 h-4" />}
                />
              </div>
            </div>

            {/* Amenidades y Servicios */}
            <div>
              <h4 className="mb-3 font-medium text-rial-navy dark:text-rial-cream">{t('filtersAdvanced.amenitiesAndServices')}</h4>
              <p className="mb-3 text-xs text-rial-muted dark:text-slate-400">{t('filtersAdvanced.selectAmenities')}</p>
              <div className="flex flex-wrap gap-2">
                {/* Amenidades básicas con checkboxes */}
                <button
                  type="button"
                  onClick={() => toggleAmenity('wifi')}
                  className={classNames(
                    'px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-200 flex items-center gap-2',
                    filters.wifi
                      ? 'border-rial-navy bg-rial-navy text-rial-cream shadow-md'
                      : 'border-rial-cream-dark/40 bg-white/90 text-rial-ink hover:bg-rial-cream-dark/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                  )}
                >
                  <Wifi className="w-4 h-4" />
                  {t('filtersAdvanced.wifi')}
                </button>
                
                <button
                  type="button"
                  onClick={() => toggleAmenity('parking')}
                  className={classNames(
                    'px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-200 flex items-center gap-2',
                    filters.parking
                      ? 'border-rial-navy bg-rial-navy text-rial-cream shadow-md'
                      : 'border-rial-cream-dark/40 bg-white/90 text-rial-ink hover:bg-rial-cream-dark/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                  )}
                >
                  <Car className="w-4 h-4" />
                  {t('filtersAdvanced.parking')}
                </button>
                
                <button
                  type="button"
                  onClick={() => toggleAmenity('airConditioning')}
                  className={classNames(
                    'px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-200',
                    filters.airConditioning
                      ? 'border-rial-navy bg-rial-navy text-rial-cream shadow-md'
                      : 'border-rial-cream-dark/40 bg-white/90 text-rial-ink hover:bg-rial-cream-dark/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                  )}
                >
                  {t('filtersAdvanced.airConditioning')}
                </button>
                
                <button
                  type="button"
                  onClick={() => toggleAmenity('heating')}
                  className={classNames(
                    'px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-200',
                    filters.heating
                      ? 'border-rial-navy bg-rial-navy text-rial-cream shadow-md'
                      : 'border-rial-cream-dark/40 bg-white/90 text-rial-ink hover:bg-rial-cream-dark/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                  )}
                >
                  {t('filtersAdvanced.heating')}
                </button>
                
                <button
                  type="button"
                  onClick={() => toggleAmenity('balcony')}
                  className={classNames(
                    'px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-200',
                    filters.balcony
                      ? 'border-rial-navy bg-rial-navy text-rial-cream shadow-md'
                      : 'border-rial-cream-dark/40 bg-white/90 text-rial-ink hover:bg-rial-cream-dark/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                  )}
                >
                  {t('filtersAdvanced.balcony')}
                </button>
                
                <button
                  type="button"
                  onClick={() => toggleAmenity('elevator')}
                  className={classNames(
                    'px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-200',
                    filters.elevator
                      ? 'border-rial-navy bg-rial-navy text-rial-cream shadow-md'
                      : 'border-rial-cream-dark/40 bg-white/90 text-rial-ink hover:bg-rial-cream-dark/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                  )}
                >
                  {t('filtersAdvanced.elevator')}
                </button>
                
                <button
                  type="button"
                  onClick={() => toggleAmenity('gym')}
                  className={classNames(
                    'px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-200',
                    filters.gym
                      ? 'border-rial-navy bg-rial-navy text-rial-cream shadow-md'
                      : 'border-rial-cream-dark/40 bg-white/90 text-rial-ink hover:bg-rial-cream-dark/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                  )}
                >
                  {t('filtersAdvanced.gym')}
                </button>
                
                <button
                  type="button"
                  onClick={() => toggleAmenity('pool')}
                  className={classNames(
                    'px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-200',
                    filters.pool
                      ? 'border-rial-navy bg-rial-navy text-rial-cream shadow-md'
                      : 'border-rial-cream-dark/40 bg-white/90 text-rial-ink hover:bg-rial-cream-dark/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                  )}
                >
                  {t('filtersAdvanced.pool')}
                </button>
                
                <button
                  type="button"
                  onClick={() => toggleAmenity('furnished')}
                  className={classNames(
                    'px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-200',
                    filters.furnished
                      ? 'border-rial-navy bg-rial-navy text-rial-cream shadow-md'
                      : 'border-rial-cream-dark/40 bg-white/90 text-rial-ink hover:bg-rial-cream-dark/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                  )}
                >
                  {t('filtersAdvanced.furnished')}
                </button>
                
                <button
                  type="button"
                  onClick={() => toggleAmenity('petsAllowed')}
                  className={classNames(
                    'px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-200',
                    filters.petsAllowed
                      ? 'border-rial-navy bg-rial-navy text-rial-cream shadow-md'
                      : 'border-rial-cream-dark/40 bg-white/90 text-rial-ink hover:bg-rial-cream-dark/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                  )}
                >
                  {t('filtersAdvanced.petsAllowed')}
                </button>
                
                {/* Amenidades adicionales del array */}
                {AMENITIES.map((amenityKey) => {
                  const active = filters.amenities?.includes(amenityKey)
                  return (
                    <button
                      key={amenityKey}
                      type="button"
                      onClick={() => toggleAmenitiesFilter(amenityKey)}
                      className={classNames(
                        'px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-200',
                        active
                      ? 'border-rial-navy bg-rial-navy text-rial-cream shadow-md'
                      : 'border-rial-cream-dark/40 bg-white/90 text-rial-ink hover:bg-rial-cream-dark/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                      )}
                    >
                      {t(`filtersAdvanced.${amenityKey}`)}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Capacidad */}
            <div>
              <h4 className="mb-3 font-medium text-rial-navy dark:text-rial-cream">{t('filtersAdvanced.capacity')}</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <Input 
                  type="number"
                  placeholder={t('filtersAdvanced.maxGuests')} 
                  value={filters.maxGuests} 
                  onChange={(value) => updateFilter('maxGuests', value)}
                  icon={<Users className="w-4 h-4" />}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botones de acción */}
      <div className="flex items-center justify-between border-t border-rial-cream-dark/40 pt-6 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={resetFilters}
            icon={<X className="w-4 h-4" />}
          >
            {t('filtersAdvanced.clearFilters')}
          </Button>
          {activeFilters > 0 && (
            <span className="text-sm text-rial-muted dark:text-slate-400">
              {activeFilters} {activeFilters !== 1 ? t('filtersAdvanced.activeFiltersCount') : t('filtersAdvanced.activeFilters')}
            </span>
          )}
        </div>
        
        <Button 
          onClick={onSearch}
          icon={<Search className="w-4 h-4" />}
          className="min-w-[120px]"
        >
          {t('filtersAdvanced.search')}
        </Button>
      </div>
    </motion.div>
  )
}

// Componente de filtros móviles
export function MobileFilters({ filters, setFilters, onSearch }: {
  filters: FilterOptions
  setFilters: (filters: FilterOptions) => void
  onSearch: () => void
}) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button 
        variant="outline" 
        onClick={() => setIsOpen(true)}
        icon={<Filter className="w-4 h-4" />}
        className="md:hidden"
      >
        {t('filtersAdvanced.title')}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          >
            <motion.div 
              className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-rial-cream-dark/40 bg-rial-cream p-6 dark:border-slate-700 dark:bg-slate-900"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-rial-navy dark:text-rial-cream">{t('filtersAdvanced.title')}</h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  icon={<X className="w-4 h-4" />}
                />
              </div>
              
              <AdvancedFilters 
                filters={filters}
                setFilters={setFilters}
                onSearch={() => {
                  onSearch()
                  setIsOpen(false)
                }}
                onReset={() => {}}
                showMap={false}
                onToggleMap={() => {}}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
