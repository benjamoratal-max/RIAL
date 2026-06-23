import React, { useEffect, useMemo, useState, useCallback, lazy, Suspense, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'react-hot-toast'
import { setAppLanguage, getAppLanguage } from './i18n'
import { 
  CreditCard, 
  Search, 
  MapPin, 
  DollarSign, 
  Star, 
  Calendar,
  Home,
  X,
  Check,
  Send,
  AlertTriangle,
  Shield,
  Globe,
  Sparkles,
  Bell
} from 'lucide-react'
import { 
  Button, 
  Input, 
  LoadingSpinner, 
  AnimatedCard, 
  StatusBadge, 
  AnimatedCounter,
  classNames 
} from './components/UI'
import { RialBrand } from './components/RialBrand'
import { NotificationPanel } from './components/NotificationPanel'
const RentalProcess = lazy(() => import('./components/RentalProcess').then(m => ({ default: m.RentalProcess })))
// Lazy loading de componentes pesados para mejorar el rendimiento inicial
const FavoritesSystem = lazy(() => import('./components/FavoritesSystem').then(m => ({ default: m.FavoritesSystem })))
const AdvancedFilters = lazy(() => import('./components/AdvancedFilters').then(m => ({ default: m.AdvancedFilters })))
const ImageGallery = lazy(() => import('./components/ImageGallery').then(m => ({ default: m.ImageGallery })))
const InteractiveMap = lazy(() => import('./components/InteractiveMap').then(m => ({ default: m.InteractiveMap })))
const UserProfile = lazy(() => import('./components/UserProfile').then(m => ({ default: m.UserProfile })))
const AlertSystem = lazy(() => import('./components/AlertSystem').then(m => ({ default: m.AlertSystem })))
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard })))
const VerificationSystem = lazy(() => import('./components/VerificationSystem').then(m => ({ default: m.VerificationSystem })))
const PropertyComparator = lazy(() => import('./components/PropertyComparator').then(m => ({ default: m.PropertyComparator })))
const AIAssistant = lazy(() => import('./components/AIAssistant').then(m => ({ default: m.AIAssistant })))
const PurchaseProcess = lazy(() => import('./components/PurchaseProcess').then(m => ({ default: m.PurchaseProcess })))
const ReservationPaymentStep = lazy(() => import('./components/ReservationPaymentStep').then(m => ({ default: m.ReservationPaymentStep })))
const CreatePropertyForm = lazy(() => import('./components/CreatePropertyForm').then(m => ({ default: m.CreatePropertyForm })))
const PaymentPanel = lazy(() => import('./components/PaymentPanel').then(m => ({ default: m.PaymentPanel })))
const AdminRequestsPanel = lazy(() => import('./components/AdminRequestsPanel').then(m => ({ default: m.AdminRequestsPanel })))
const OwnerLeadsPanel = lazy(() => import('./components/OwnerLeadsPanel').then(m => ({ default: m.OwnerLeadsPanel })))
const BrokerListingsPanel = lazy(() => import('./components/BrokerListingsPanel').then(m => ({ default: m.BrokerListingsPanel })))
const BrokerLeadsDashboard = lazy(() => import('./components/BrokerLeadsDashboard').then(m => ({ default: m.BrokerLeadsDashboard })))
const ComplianceBrokerVerificationsPanel = lazy(() => import('./components/ComplianceBrokerVerificationsPanel').then(m => ({ default: m.ComplianceBrokerVerificationsPanel })))
const ComplianceListingsReviewPanel = lazy(() => import('./components/ComplianceListingsReviewPanel').then(m => ({ default: m.ComplianceListingsReviewPanel })))
const ComplianceIncidentsPanel = lazy(() => import('./components/ComplianceIncidentsPanel').then(m => ({ default: m.ComplianceIncidentsPanel })))
const ComplianceSuspensionsPanel = lazy(() => import('./components/ComplianceSuspensionsPanel').then(m => ({ default: m.ComplianceSuspensionsPanel })))
const ComplianceAuditLogsPanel = lazy(() => import('./components/ComplianceAuditLogsPanel').then(m => ({ default: m.ComplianceAuditLogsPanel })))
const ScheduleVisit = lazy(() => import('./components/ScheduleVisit').then(m => ({ default: m.ScheduleVisit })))

// Componentes críticos cargados normalmente (necesarios para el render inicial)
import { AuthPanel } from './components/AuthPanel'
import { WelcomeScreen } from './components/WelcomeScreen'
import { CookieConsent } from './components/CookieConsent'
import { AppSidebar } from './components/AppSidebar'
import { MobileBottomNav, type MobileNavTab } from './components/MobileBottomNav'
import { RoleNavStrip } from './components/RoleNavStrip'
import { PropertyCard } from './components/PropertyCard'
import { useAuth } from './hooks/useAuth'
import { useDebouncedValue } from './hooks/useDebounce'
import { type PropertySummary } from './data/properties'
import { api } from './utils/api'
import { getErrorMessage } from './utils/errorHandler'

const DEFAULT_FILTERS = {
  location: '',
  minPrice: '',
  maxPrice: '',
  sort: '',
  page: 1,
  pageSize: 12,
  bedrooms: '',
  rooms: '',
  bathrooms: '',
  propertyType: '',
  amenities: [] as string[],
  availableFrom: '',
  availableTo: '',
  rating: '',
  maxGuests: '',
  query: '',
  // Toda la oferta visible se centra en brokers verificados
  verified: true,
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
} as const

const MOCK_CENTER = { lat: 25.7617, lng: -80.1918 }
const MAP_VIEWPORT_STORAGE_KEY = 'rial_map_viewport'

// Caché local del listado (stale-while-revalidate): muestra al instante el último
// resultado conocido mientras el backend responde. Clave: el querystring de filtros.
const PROPERTIES_CACHE_PREFIX = 'rial_props_cache:'
const PROPERTIES_CACHE_TTL = 30 * 60 * 1000 // 30 min
const PROPERTIES_CACHE_MAX_ENTRIES = 12

type PropertiesCacheEntry = { items: PropertySummary[]; total: number; savedAt: number }

function readPropertiesCache(key: string): PropertiesCacheEntry | null {
  try {
    const raw = localStorage.getItem(PROPERTIES_CACHE_PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PropertiesCacheEntry
    if (!parsed || !Array.isArray(parsed.items)) return null
    if (Date.now() - parsed.savedAt > PROPERTIES_CACHE_TTL) return null
    return parsed
  } catch {
    return null
  }
}

function writePropertiesCache(key: string, items: PropertySummary[], total: number) {
  try {
    // Limitar la cantidad de entradas para no llenar localStorage.
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(PROPERTIES_CACHE_PREFIX))
    if (keys.length >= PROPERTIES_CACHE_MAX_ENTRIES) {
      // Eliminar la más vieja
      let oldestKey: string | null = null
      let oldestAt = Infinity
      for (const k of keys) {
        try {
          const e = JSON.parse(localStorage.getItem(k) || '{}')
          if (typeof e.savedAt === 'number' && e.savedAt < oldestAt) {
            oldestAt = e.savedAt
            oldestKey = k
          }
        } catch {
          oldestKey = k
          break
        }
      }
      if (oldestKey) localStorage.removeItem(oldestKey)
    }
    const entry: PropertiesCacheEntry = { items, total, savedAt: Date.now() }
    localStorage.setItem(PROPERTIES_CACHE_PREFIX + key, JSON.stringify(entry))
  } catch {
    // Cuota llena u otro problema: ignorar, la caché es best-effort.
  }
}

type MapViewport = { lat: number; lng: number; zoom: number }

function readStoredMapViewport(): MapViewport | null {
  try {
    const raw = sessionStorage.getItem(MAP_VIEWPORT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as MapViewport
    if (
      typeof parsed.lat === 'number' &&
      typeof parsed.lng === 'number' &&
      typeof parsed.zoom === 'number' &&
      Number.isFinite(parsed.lat) &&
      Number.isFinite(parsed.lng) &&
      Number.isFinite(parsed.zoom)
    ) {
      return parsed
    }
  } catch {
    // ignore
  }
  return null
}

// Función eliminada - ahora usamos directamente getMockProperties

function normalizeGeoProperty(property: any, index: number) {
  const lat = typeof property.latitude === 'number' ? property.latitude : undefined
  const lng = typeof property.longitude === 'number' ? property.longitude : undefined
  return { ...property, latitude: lat, longitude: lng }
}

// Función api movida a ./utils/api.ts para reutilización



function PropertyDetail({ id, onClose, token, user, initialItem }: { id: number; onClose: () => void; token?: string | null; user: any; initialItem?: PropertySummary | null }) {
  const { t, i18n } = useTranslation()
  const [summary, setSummary] = useState<PropertySummary | null>(
    initialItem?.property?.id === id ? initialItem : null
  )
  const [loadError, setLoadError] = useState(false)
  const [review, setReview] = useState({ rating: 5 as any, comment: '' })
  const [showRentalProcess, setShowRentalProcess] = useState(false)
  const [showPurchaseProcess, setShowPurchaseProcess] = useState(false)
  const [showScheduleVisit, setShowScheduleVisit] = useState(false)
  const [duplicateAlerts, setDuplicateAlerts] = useState<Array<{ id: number; similarityScore: number; suspectedDuplicateOf?: { id: number; title: string; location?: string } }>>([])
  const canReview = Boolean(user)

  useEffect(() => {
    let mounted = true
    if (initialItem?.property?.id !== id) {
      setSummary(null)
    }
    setLoadError(false)
    ;(async () => {
      try {
        const data = await api(`/api/properties/${id}/summary`)
        if (mounted) setSummary(data || null)
      } catch (error) {
        if (!mounted) return
        if (!initialItem || initialItem.property?.id !== id) setLoadError(true)
      }
    })()
    return () => {
      mounted = false
    }
  }, [id, initialItem])

  // Alertas de duplicados (solo propietario o admin de esta propiedad)
  useEffect(() => {
    if (!token || !user || (user.role !== 'owner' && user.role !== 'admin') || !id) {
      setDuplicateAlerts([])
      return
    }
    let cancelled = false
    api(`/api/properties/${id}/duplicate-alerts`, { token })
      .then((data: { alerts?: any[] }) => { if (!cancelled && data?.alerts) setDuplicateAlerts(data.alerts) })
      .catch(() => { if (!cancelled) setDuplicateAlerts([]) })
    return () => { cancelled = true }
  }, [id, token, user])

  if (!summary && !loadError)
    return (
      <motion.div 
        className="fixed inset-0 bg-black/40 backdrop-blur flex items-center justify-center p-4 z-[10050]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div 
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-2xl"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <LoadingSpinner size="lg" text={t('app.loadingDetails')} />
        </motion.div>
      </motion.div>
    )

  if (!summary && loadError) {
    return (
      <motion.div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10050] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('errors.title')}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{t('propertyDetail.couldNotLoad')}</p>
          <div className="mt-4 flex justify-center">
            <Button onClick={onClose}>{t('createProperty.close')}</Button>
          </div>
        </div>
      </motion.div>
    )
  }

  if (!summary) return null
  const { property, isAvailable, averageRating, reviewsCount, latestReviews } = summary
  if (!property) return null

  const locale = property.currency === 'EUR' ? 'es-ES' : 'es-AR'
  const moneyFormatter = new Intl.NumberFormat(locale, { style: 'currency', currency: property.currency || 'USD', maximumFractionDigits: 0 })
  const formatMoney = (value?: number) => (typeof value === 'number' ? moneyFormatter.format(value) : t('common.consult'))
  const rentAvailable = property.availableFor?.includes('rent')
  const buyAvailable = property.availableFor?.includes('buy')
  const normalizedType = String(property.type || (property as any).propertyType || '').toLowerCase()
  const isHouseLike = ['house', 'casa', 'townhouse', 'villa'].some((term) => normalizedType.includes(term))
  const localizePropertyType = (rawType: string) => {
    const normalized = String(rawType || '').toLowerCase()
    if (!normalized) return t('common.consult')
    if (normalized.includes('house') || normalized.includes('casa')) return t('propertyTypes.house')
    if (normalized.includes('apartment') || normalized.includes('apartamento') || normalized.includes('depto') || normalized.includes('departamento') || normalized.includes('condo') || normalized.includes('condominio')) {
      return t('propertyTypes.apartment')
    }
    if (normalized.includes('studio') || normalized.includes('estudio') || normalized.includes('monoambiente')) return t('propertyTypes.studio')
    if (normalized.includes('loft')) return t('propertyTypes.loft')
    if (normalized.includes('penthouse')) return t('propertyTypes.penthouse')
    if (normalized.includes('villa')) return t('propertyTypes.villa')
    if (normalized.includes('townhouse') || normalized.includes('adosada')) return t('propertyTypes.townhouse')
    return rawType
  }
  const localizeSubtitle = (subtitle: string) => {
    const normalized = String(subtitle || '').toLowerCase().trim()
    if (!normalized) return subtitle
    if (normalized === 'house' || normalized === 'casa') return t('propertyTypes.house')
    if (normalized === 'apartment' || normalized === 'apartamento' || normalized === 'departamento') return t('propertyTypes.apartment')
    if (normalized === 'studio' || normalized === 'estudio') return t('propertyTypes.studio')
    if (normalized === 'loft') return t('propertyTypes.loft')
    if (normalized === 'penthouse') return t('propertyTypes.penthouse')
    if (normalized === 'villa') return t('propertyTypes.villa')
    if (normalized === 'townhouse') return t('propertyTypes.townhouse')
    return subtitle
  }

  const amenityGroups = [
    {
      title: isHouseLike ? t('propertyDetail.insideHouse') : t('propertyDetail.insideApt'),
      items: property.amenities || [],
    },
    {
      title: isHouseLike ? t('propertyDetail.outdoorAmenities') : t('propertyDetail.buildingAmenities'),
      items: property.buildingAmenities || [],
    },
    { title: t('propertyDetail.security'), items: property.safety || [] },
  ]

  const rentalMonthsLabel = (() => {
    const raw = (property as { rentalMonths?: string }).rentalMonths
    if (!raw) return null
    const months = raw
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((m) => [3, 6, 12].includes(m))
      .sort((a, b) => a - b)
    if (!months.length) return null
    return months.map((m) => t('createProperty.rentalMonthOption', { months: m })).join(' · ')
  })()

  const detailFacts = [
    { label: t('propertyDetail.neighborhood'), value: property.neighborhood },
    { label: t('propertyDetail.city'), value: `${property.city}, ${property.country}` },
    { label: t('propertyDetail.totalRooms'), value: `${property.rooms ?? property.bedrooms}` },
    { label: t('propertyDetail.yearBuilt'), value: property.yearBuilt },
    ...(rentalMonthsLabel
      ? [{ label: t('propertyDetail.rentalTerms'), value: rentalMonthsLabel }]
      : []),
    { label: t('propertyDetail.deposit'), value: formatMoney(property.deposit) },
    { label: t('propertyDetail.expenses'), value: property.hoa ? formatMoney(property.hoa) : t('propertyDetail.included') },
    { label: t('propertyDetail.modality'), value: property.availableFor?.map((mode: string) => (mode === 'buy' ? t('propertyDetail.modalityBuy') : t('propertyDetail.modalityRent'))).join(' · ') || t('common.consult') }
  ]

  const broker = (property as any).broker

  return (
    <motion.div 
      className="fixed inset-0 bg-black/40 backdrop-blur flex items-center justify-center p-4 z-[10050]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-rial-cream-dark/50 bg-rial-cream p-0 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-20 flex justify-end border-b border-rial-cream-dark/40 bg-rial-cream/95 px-4 py-3 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/90">
          <Button variant="outline" size="sm" onClick={onClose} icon={<X className="h-4 w-4" />}>
            {t('propertyDetail.close')}
          </Button>
        </div>

        <div className="space-y-8 p-4 md:p-6">
          <motion.div
            className="flex flex-col gap-8 md:flex-row md:items-start"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <div className="md:max-w-md md:w-[42%] md:shrink-0">
              <div className="relative overflow-hidden rounded-2xl border border-rial-cream-dark/50 bg-rial-navy/[0.04] dark:border-slate-700 dark:bg-slate-800/40">
                <Suspense fallback={<LoadingSpinner text={t('app.loadingGallery')} />}>
                  <ImageGallery images={property.images || []} title={property.title} />
                </Suspense>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rial-muted dark:text-slate-400">
                  {localizeSubtitle(property.subtitle)} · {property.city}
                  {property.country ? `, ${property.country}` : ''}
                </p>
                <h2 className="mt-2 font-serif text-2xl font-medium leading-tight tracking-tight text-rial-navy md:text-3xl dark:text-rial-cream">
                  {property.title}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-rial-muted dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4 shrink-0" />
                    {property.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-current text-amber-500" />
                    {averageRating.toFixed(1)} · {reviewsCount} {t('propertyDetail.reviewsCount')}
                  </span>
                  <span
                    className={classNames(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                      isAvailable
                        ? 'bg-rial-verified-soft text-rial-verified dark:bg-emerald-900/40 dark:text-emerald-200'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200'
                    )}
                  >
                    {isAvailable ? t('common.available') : t('common.reserved')}
                  </span>
                </div>
                {broker?.isVerifiedBroker && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-rial-verified dark:text-emerald-300">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 font-semibold dark:bg-emerald-900/40">
                      <Shield className="h-3 w-3" />
                      {t('propertyDetail.listedByVerifiedBroker')}
                    </span>
                    {broker.name && <span>· {broker.name}</span>}
                    {broker.brokerageName && <span>· {broker.brokerageName}</span>}
                    {broker.licenseState && (
                      <span className="text-[11px] opacity-80">
                        {t('propertyDetail.licenseLabel')}: {broker.licenseType ? `${broker.licenseType} · ` : ''}
                        {broker.licenseState}
                        {broker.licenseExpiration &&
                          ` · ${t('propertyDetail.licenseExpires')}: ${new Date(broker.licenseExpiration).toLocaleDateString()}`}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4 border-b border-rial-cream-dark/40 pb-5 dark:border-slate-700 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-serif text-3xl tracking-tight text-rial-navy dark:text-rial-cream md:text-4xl">
                    {formatMoney(property.price)}
                    <span className="ml-2 align-baseline font-sans text-base font-medium text-rial-muted dark:text-slate-400">
                      {t('propertyDetail.perMonth')}
                    </span>
                  </p>
                  {rentAvailable && (
                    <p className="mt-1 text-sm text-rial-muted dark:text-slate-400">
                      {t('propertyDetail.deposit')}: {formatMoney(property.deposit)} · {t('propertyDetail.expenses')}:{' '}
                      {property.hoa ? formatMoney(property.hoa) : t('propertyDetail.included')}
                    </p>
                  )}
                  {buyAvailable && !rentAvailable && (
                    <p className="mt-1 font-serif text-2xl text-rial-navy dark:text-rial-cream">{formatMoney(property.salePrice)}</p>
                  )}
                  {buyAvailable && rentAvailable && (
                    <p className="mt-2 text-sm text-rial-muted dark:text-slate-400">
                      {t('propertyDetail.buyDirectOrLeasing')}{' '}
                      <span className="font-semibold text-rial-ink dark:text-slate-100">{formatMoney(property.salePrice)}</span>
                    </p>
                  )}
                </div>
                <div className="flex min-w-[200px] shrink-0 flex-col gap-2">
                  {rentAvailable && isAvailable && (
                    <Button
                      variant="navy"
                      icon={<CreditCard className="h-4 w-4" />}
                      onClick={async () => {
                        if (!user) {
                          toast.error(t('propertyDetail.loginToRent'))
                          return
                        }
                        if (!token) {
                          toast.error(t('propertyDetail.loginToRent'))
                          return
                        }
                        try {
                          const status = await api('/api/verification/status', { token })
                          if (status?.verified !== true) {
                            toast.error(t('propertyDetail.verifyAccountToRent'))
                            return
                          }
                          setShowRentalProcess(true)
                        } catch {
                          toast.error(t('propertyDetail.verifyAccountToRent'))
                        }
                      }}
                    >
                      {t('propertyDetail.startRental')}
                    </Button>
                  )}
                  {rentAvailable && !isAvailable && (
                    <Button
                      variant="navy"
                      disabled
                      icon={<CreditCard className="h-4 w-4" />}
                    >
                      {t('propertyDetail.alreadyRented')}
                    </Button>
                  )}
                  {buyAvailable && (
                    <Button
                      variant="secondary"
                      icon={<Home className="h-4 w-4" />}
                      onClick={async () => {
                        if (!user) {
                          toast.error(t('propertyDetail.loginToBuy'))
                          return
                        }
                        if (!token) {
                          toast.error(t('propertyDetail.loginToBuy'))
                          return
                        }
                        try {
                          const status = await api('/api/verification/status', { token })
                          if (status?.verified !== true) {
                            toast.error(t('propertyDetail.verifyAccountToBuy'))
                            return
                          }
                          setShowPurchaseProcess(true)
                        } catch {
                          toast.error(t('propertyDetail.verifyAccountToBuy'))
                        }
                      }}
                    >
                      {t('propertyDetail.wantToBuy')}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    icon={<Calendar className="h-4 w-4" />}
                    onClick={() => {
                      if (!user || !token) {
                        toast.error(t('scheduleVisit.loginRequired'))
                        return
                      }
                      setShowScheduleVisit(true)
                    }}
                  >
                    {t('propertyDetail.scheduleVisit')}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 text-sm text-rial-ink/90 dark:text-slate-200">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1.5 ring-1 ring-rial-cream-dark/40 dark:bg-slate-800/80 dark:ring-slate-600">
                  <Home className="h-4 w-4 text-rial-navy dark:text-rial-gold" />
                  {property.rooms ?? property.bedrooms} {t('propertyDetail.roomsShort')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1.5 ring-1 ring-rial-cream-dark/40 dark:bg-slate-800/80 dark:ring-slate-600">
                  {property.bedrooms} {t('propertyDetail.bedroomsShort')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1.5 ring-1 ring-rial-cream-dark/40 dark:bg-slate-800/80 dark:ring-slate-600">
                  {property.bathrooms} {t('propertyDetail.bathroomsShort')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1.5 ring-1 ring-rial-cream-dark/40 dark:bg-slate-800/80 dark:ring-slate-600">
                  {property.area} m²
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1.5 ring-1 ring-rial-cream-dark/40 dark:bg-slate-800/80 dark:ring-slate-600">
                  {localizePropertyType(property.type)}
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <p className="leading-relaxed text-rial-ink/90 dark:text-slate-200">
              {i18n.language === 'en' && (property as any).descriptionEn
                ? (property as any).descriptionEn
                : property.description}
            </p>
            {!!property.highlights?.length && (
              <div className="flex flex-wrap gap-2">
                {property.highlights
                  .filter((highlight: string) => Boolean(highlight && highlight.trim()))
                  .map((highlight: string, idx: number) => (
                    <span
                      key={`highlight-${idx}-${highlight}`}
                      className="rounded-full bg-rial-navy/5 px-3 py-1 text-xs font-medium text-rial-navy ring-1 ring-rial-cream-dark/50 dark:bg-slate-800 dark:text-rial-cream dark:ring-slate-600"
                    >
                      {highlight}
                    </span>
                  ))}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {detailFacts.map((fact, idx) => (
                <div
                  key={`fact-${idx}-${fact.label || 'label'}`}
                  className="rounded-xl border border-rial-cream-dark/40 bg-white/60 p-3 dark:border-slate-700 dark:bg-slate-800/60"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-rial-muted dark:text-slate-400">{fact.label}</p>
                  <p className="text-sm font-semibold text-rial-ink dark:text-slate-100">{fact.value}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div 
          className="mb-6 grid gap-4 px-4 md:grid-cols-3 md:px-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          {amenityGroups.map((group, groupIdx) => (
            <div key={`amenity-group-${groupIdx}-${group.title || 'group'}`} className="rounded-2xl border border-rial-cream-dark/40 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-800/70">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">{group.title}</h4>
              {group.items.length ? (
                <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  {group.items
                    .filter((item: string) => Boolean(item && item.trim()))
                    .map((item: string, idx: number) => (
                    <li key={`${group.title}-${item}-${idx}`} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-500 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('propertyDetail.noInfo')}</p>
              )}
            </div>
          ))}
        </motion.div>

        <motion.div 
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">{t('propertyDetail.latestReviews')}</h3>
          {latestReviews?.length ? (
            <div className="space-y-3">
              {latestReviews.map((r: any, i: number) => (
                <motion.div 
                  key={`review-${i}-${r.id || r.user?.id || 'anon'}`}
                  className="p-3 bg-gray-50 dark:bg-gray-700 rounded-xl"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="flex items-center mb-1">
                    <div className="flex items-center text-sm">
                      {[...Array(5)].map((_, idx) => (
                        <Star 
                          key={idx} 
                          className={`w-4 h-4 ${idx < r.rating ? 'text-yellow-500 fill-current' : 'text-gray-300'}`} 
                        />
                      ))}
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white ml-2">
                      {r.user?.name || t('propertyDetail.user')}
                    </span>
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">{r.comment}</div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              {t('propertyDetail.noReviews')}
            </div>
          )}
        </motion.div>

        {duplicateAlerts && duplicateAlerts.length > 0 && (
          <motion.div
            className="mb-6 p-4 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32 }}
          >
            <h3 className="font-semibold mb-3 text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {t('propertyDetail.duplicateAlertsTitle')}
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">{t('propertyDetail.duplicateAlertsDescription')}</p>
            <ul className="space-y-2">
              {duplicateAlerts.map((alert) => (
                <li key={alert.id} className="flex items-center justify-between gap-2 text-sm p-2 rounded-xl bg-amber-100/50 dark:bg-amber-900/30">
                  <span className="text-gray-800 dark:text-gray-200 truncate">
                    {alert.suspectedDuplicateOf?.title || t('propertyDetail.duplicatePropertyId', { id: alert.suspectedDuplicateOf?.id ?? '?' })}
                  </span>
                  <span className="text-amber-700 dark:text-amber-300 font-medium shrink-0">
                    {Math.round((alert.similarityScore ?? 0) * 100)}% {t('propertyDetail.similarity')}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {canReview && (
          <motion.form 
            className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-700 grid md:grid-cols-4 gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            onSubmit={async (e) => {
              e.preventDefault()
              try {
                await api('/api/reviews', { 
                  method: 'POST', 
                  token, 
                  body: { 
                    propertyId: property.id, 
                    rating: Number(review.rating), 
                    comment: review.comment 
                  } 
                })
                const data = await api(`/api/properties/${id}/summary`)
                setSummary(data)
                setReview({ rating: 5 as any, comment: '' })
                toast.success(t('propertyDetail.reviewSent'))
              } catch (e: any) {
                toast.error(getErrorMessage(e))
              }
            }}
          >
            <div className="flex flex-col gap-1.5 min-w-0">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('propertyDetail.yourRating')}
              </span>
              <div className="flex items-center justify-center gap-0.5 p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 min-h-[44px] w-full max-w-full overflow-hidden">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setReview({ ...review, rating: n })}
                    className="flex-shrink-0 rounded-lg p-1 transition-colors hover:bg-rial-cream-dark/40 focus:outline-none focus:ring-2 focus:ring-rial-gold focus:ring-inset dark:hover:bg-slate-700"
                    aria-label={`${n} ${t('propertyDetail.stars')}`}
                  >
                    <Star
                      className={`w-6 h-6 transition-colors ${
                        n <= review.rating
                          ? 'text-amber-400 dark:text-amber-500 fill-amber-400 dark:fill-amber-500'
                          : 'text-gray-300 dark:text-gray-500 fill-transparent'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <input 
              className="input md:col-span-2" 
              placeholder={t('propertyDetail.writeComment')} 
              value={review.comment} 
              onChange={(e) => setReview({ ...review, comment: e.target.value })} 
            />
            <Button type="submit" className="w-full" icon={<Star className="w-4 h-4" />}>
              {t('propertyDetail.sendReview')}
            </Button>
          </motion.form>
        )}
      </motion.div>
      
      {/* Proceso digital de Alquilar */}
      <AnimatePresence>
        {showRentalProcess && summary && summary.property && (
          <Suspense fallback={<LoadingSpinner text={t('app.loadingProcess')} />}>
            <RentalProcess
              property={summary.property}
              user={user}
              token={token ?? ''}
              onClose={() => setShowRentalProcess(false)}
              onComplete={() => {
                toast.success(t('propertyDetail.rentalProcessStarted'))
                setShowRentalProcess(false)
              }}
            />
          </Suspense>
        )}
      </AnimatePresence>
      {/* Proceso de Compra */}
      <AnimatePresence>
        {showPurchaseProcess && summary && summary.property && (
          <Suspense fallback={<LoadingSpinner text={t('app.loadingProcess')} />}>
            <PurchaseProcess
              property={summary.property}
              user={user}
              token={token ?? ''}
              onClose={() => setShowPurchaseProcess(false)}
              onComplete={() => {
                toast.success(t('propertyDetail.purchaseProcessStarted'))
                setShowPurchaseProcess(false)
              }}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Agendar visita */}
      <AnimatePresence>
        {showScheduleVisit && summary?.property && (
          <Suspense fallback={null}>
            <ScheduleVisit
              property={{
                id: summary.property.id,
                title: summary.property.title,
                location: summary.property.location
              }}
              token={token ?? ''}
              user={user}
              onClose={() => setShowScheduleVisit(false)}
              onSuccess={() => setShowScheduleVisit(false)}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function App() {
  const { t } = useTranslation()
  const { token, user, requires2FA, twoFactorMethod, onLogin, verify2FA, onRegister, onLogout, updateUser } = useAuth()

  // Modo invitado: el usuario entró sin iniciar sesión desde la pantalla de bienvenida.
  // Solo ve propiedades, detalles y mapa; las funciones exclusivas quedan ocultas.
  const [guestMode, setGuestMode] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('rial_guest_mode') === '1'
    } catch {
      return false
    }
  })

  const continueAsGuest = useCallback(() => {
    try {
      sessionStorage.setItem('rial_guest_mode', '1')
    } catch {
      // ignore storage errors
    }
    setGuestMode(true)
  }, [])

  // Al cerrar sesión, volvemos a la pantalla de bienvenida (no a modo invitado).
  const handleLogout = useCallback(
    (opts?: { quiet?: boolean }) => {
      try {
        sessionStorage.removeItem('rial_guest_mode')
      } catch {
        // ignore storage errors
      }
      setGuestMode(false)
      onLogout(opts)
    },
    [onLogout]
  )

  useEffect(() => {
    const lang = user?.preferences?.language
    if (lang === 'es' || lang === 'en') setAppLanguage(lang)
  }, [user?.preferences?.language])

  const [filters, setFilters] = useState<any>({ ...DEFAULT_FILTERS })
  const debouncedLocation = useDebouncedValue(filters.location, 400)
  const debouncedQuery = useDebouncedValue(filters.query, 400)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<PropertySummary[]>([])
  const [total, setTotal] = useState(0)
  const [propertiesError, setPropertiesError] = useState<string | null>(null)
  const [assistantCatalog, setAssistantCatalog] = useState<any[]>([])
  const [openId, setOpenId] = useState<number | null>(null)

  // Listado completo para el asistente de IA (así puede recomendar/filtrar sobre todo el catálogo)
  const fullListForAssistant = useMemo(
    () => assistantCatalog.length ? assistantCatalog : items.map((it) => it?.property).filter(Boolean),
    [assistantCatalog, items]
  )

  // Abrir propiedad desde enlace compartido (?property=123)
  // No limpiar la URL aquí: con StrictMode el efecto corre dos veces y al limpiar
  // en la primera, la segunda ya no ve el param. Se limpia al cerrar el modal.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const idParam = params.get('property')
    if (idParam) {
      const id = parseInt(idParam, 10)
      if (!Number.isNaN(id) && id > 0) setOpenId(id)
    }
  }, [])

  // Retorno desde Stripe Checkout (?stripe=success|cancel&reservation=ID). Abrimos un
  // modal con el estado de la reserva y confirmamos el pago con session_id si está.
  const [stripeReturn, setStripeReturn] = useState<{
    reservationId: number
    notice: 'success' | 'cancel'
    sessionId?: string
  } | null>(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const stripeParam = params.get('stripe')
    const reservationParam = params.get('reservation')
    const sessionIdParam = params.get('session_id')
    if ((stripeParam === 'success' || stripeParam === 'cancel') && reservationParam) {
      const rid = parseInt(reservationParam, 10)
      if (!Number.isNaN(rid) && rid > 0) {
        setStripeReturn({
          reservationId: rid,
          notice: stripeParam,
          sessionId: sessionIdParam || undefined,
        })
      }
      params.delete('stripe')
      params.delete('reservation')
      params.delete('kind')
      params.delete('session_id')
      const qs = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''))
    }
  }, [])

  // Apertura por click en una notificación push (?brokerView=listings → panel de seguimiento).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('brokerView') === 'listings') {
      setShowBrokerListings(true)
      params.delete('brokerView')
      const qs = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''))
    }
  }, [])

  // Nuevos estados para las funcionalidades
  const [showNotifications, setShowNotifications] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showPayments, setShowPayments] = useState(false)
  const [showUserProfile, setShowUserProfile] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [mapViewport, setMapViewport] = useState<MapViewport | null>(readStoredMapViewport)
  /** Mantiene el mapa montado mientras el detalle está abierto si se entró desde el mapa */
  const [mapPinnedForDetail, setMapPinnedForDetail] = useState(false)
  const [showAlerts, setShowAlerts] = useState(false)
  const openNotifications = useCallback(() => {
    setShowChat(false)
    setShowPayments(false)
    setShowUserProfile(false)
    setShowAlerts(false)
    setShowNotifications(true)
  }, [])
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showOwnerLeads, setShowOwnerLeads] = useState(false)
  const [showBrokerLeads, setShowBrokerLeads] = useState(false)
  const [showBrokerListings, setShowBrokerListings] = useState(false)
  const [showAdminRequests, setShowAdminRequests] = useState(false)
  const [showCompliancePanel, setShowCompliancePanel] = useState(false)
  const [showComplianceListings, setShowComplianceListings] = useState(false)
  const [showComplianceIncidents, setShowComplianceIncidents] = useState(false)
  const [showComplianceSuspensions, setShowComplianceSuspensions] = useState(false)
  const [showComplianceAuditLogs, setShowComplianceAuditLogs] = useState(false)
  const [showComparison, setShowComparison] = useState(false)
  const [comparisonIds, setComparisonIds] = useState<number[]>([])
  const [comparisonItems, setComparisonItems] = useState<PropertySummary[]>([])
  const [notificationCount, setNotificationCount] = useState(0)
  const [messageCount, setMessageCount] = useState(0)
  const [mobileNavTab, setMobileNavTab] = useState<MobileNavTab>('explore')

  /** Abre la ficha sin salir del mapa; al cerrar se restaura la misma vista. */
  const handleOpenPropertyDetail = useCallback((id: number) => {
    if (showMap) {
      setMapPinnedForDetail(true)
    }
    setOpenId(id)
  }, [showMap])

  const handleMapViewportChange = useCallback((viewport: MapViewport) => {
    setMapViewport(viewport)
    try {
      sessionStorage.setItem(MAP_VIEWPORT_STORAGE_KEY, JSON.stringify(viewport))
    } catch {
      // ignore storage errors
    }
  }, [])

  const handleClosePropertyDetail = useCallback(() => {
    const returnToMap = mapPinnedForDetail
    setOpenId(null)
    const url = new URL(window.location.href)
    if (url.searchParams.has('property')) {
      url.searchParams.delete('property')
      window.history.replaceState({}, '', url.pathname + (url.search || ''))
    }
    if (returnToMap) {
      setShowMap(true)
      setMobileNavTab('map')
      setMapPinnedForDetail(false)
    }
  }, [mapPinnedForDetail])

  const handleAddToComparison = useCallback((item: PropertySummary) => {
    setComparisonItems((prev) => (prev.some((i) => i.property.id === item.property.id) ? prev : [...prev, item]))
    setComparisonIds((prev) => (prev.includes(item.property.id) ? prev : [...prev, item.property.id]))
  }, [])
  const handleRemoveFromComparison = useCallback((id: number) => {
    setComparisonIds((prev) => prev.filter((x) => x !== id))
    setComparisonItems((prev) => prev.filter((it) => it.property.id !== id))
  }, [])
  const handleComparisonIdsChange = useCallback((ids: number[]) => {
    setComparisonIds(ids)
    setComparisonItems((prev) => prev.filter((it) => ids.includes(it.property.id)))
  }, [])
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const calendar = params.get('calendar')
    if (!calendar) return
    if (calendar === 'connected') {
      toast.success(t('brokerCalendar.oauthSuccess'))
      setShowUserProfile(true)
    } else if (calendar === 'error') {
      toast.error(t('brokerCalendar.oauthError'))
    }
    params.delete('calendar')
    params.delete('reason')
    const qs = params.toString()
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''))
  }, [t])

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    return saved ? JSON.parse(saved) : false
  })

  // Aplicar modo oscuro
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
  }, [darkMode])

  // Navegación principal según rol
  type RenterNavKey = 'explore' | 'saved' | 'messages' | 'showings' | 'documents' | 'applications' | 'profile'
  type BrokerNavKey = 'dashboard' | 'leads' | 'listings' | 'calendar' | 'brokerDocuments' | 'brokerMessages' | 'analytics' | 'team' | 'settings'
  type ComplianceNavKey = 'brokerVerifications' | 'listingsReview' | 'reports' | 'flags' | 'suspensions' | 'auditLogs'

  const [renterNav, setRenterNav] = useState<RenterNavKey>('explore')
  const [brokerNav, setBrokerNav] = useState<BrokerNavKey>('dashboard')
  const [complianceNav, setComplianceNav] = useState<ComplianceNavKey>('brokerVerifications')

  const loadAbortRef = useRef<AbortController | null>(null)
  // Cache en memoria del catálogo de IA: evita re-fetchear todas las propiedades cada vez
  // que el usuario abre el chat. TTL 10 min porque las propiedades cambian poco.
  const assistantCatalogCacheRef = useRef<{ data: any[]; expiresAt: number } | null>(null)

  const loadAssistantCatalog = useCallback(async () => {
    try {
      // Cache hit: usar los datos cacheados sin pegarle al backend
      const cached = assistantCatalogCacheRef.current
      if (cached && cached.expiresAt > Date.now()) {
        setAssistantCatalog(cached.data)
        return
      }

      const pageSize = 200
      const authOpts = token ? { token } : {}
      const first = await api(`/api/ai/property-catalog?verified=true&page=1&pageSize=${pageSize}`, authOpts)
      const totalPages = Math.min(8, Math.max(1, Number(first?.totalPages) || 1))
      const allRows: any[] = [...(Array.isArray(first?.items) ? first.items : [])]

      const CONCURRENCY = 6
      for (let start = 2; start <= totalPages; start += CONCURRENCY) {
        const batch: Promise<any>[] = []
        for (let p = start; p < start + CONCURRENCY && p <= totalPages; p++) {
          batch.push(api(`/api/ai/property-catalog?verified=true&page=${p}&pageSize=${pageSize}`, authOpts))
        }
        const pages = await Promise.all(batch)
        for (const data of pages) {
          if (Array.isArray(data?.items)) allRows.push(...data.items)
        }
      }

      const uniqueById = Array.from(new Map(allRows.map((p: any) => [p.id, p])).values())
      // Guardar en cache por 10 min
      assistantCatalogCacheRef.current = { data: uniqueById, expiresAt: Date.now() + 10 * 60 * 1000 }
      setAssistantCatalog(uniqueById)
    } catch {
      setAssistantCatalog([])
    }
  }, [token])

  // Catálogo del asistente: solo al abrir el chat (evita cientos de requests al inicio).
  useEffect(() => {
    if (!showChat) return
    void loadAssistantCatalog()
  }, [showChat, loadAssistantCatalog])

  const load = useCallback(async (customFilters?: any) => {
    loadAbortRef.current?.abort()
    const ac = new AbortController()
    loadAbortRef.current = ac

    const activeFilters = customFilters ? { ...customFilters } : { ...filters }
    // Asegurar que page y pageSize tengan valores por defecto
    activeFilters.page = activeFilters.page || 1
    activeFilters.pageSize = activeFilters.pageSize || 12

    const qs = new URLSearchParams()
    if (activeFilters.query) qs.set('query', activeFilters.query)
    if (activeFilters.location) qs.set('location', activeFilters.location)
    if (activeFilters.minPrice) qs.set('minPrice', String(activeFilters.minPrice))
    if (activeFilters.maxPrice) qs.set('maxPrice', String(activeFilters.maxPrice))
    if (activeFilters.bedrooms) qs.set('bedrooms', String(activeFilters.bedrooms))
    if (activeFilters.rooms) qs.set('rooms', String(activeFilters.rooms))
    if (activeFilters.bathrooms) qs.set('bathrooms', String(activeFilters.bathrooms))
    if (activeFilters.propertyType) qs.set('propertyType', activeFilters.propertyType)
    if (activeFilters.verified) qs.set('verified', 'true')
    const amenitySet = new Set<string>(Array.isArray(activeFilters.amenities) ? activeFilters.amenities : [])
    if (activeFilters.pool) amenitySet.add('pool')
    if (activeFilters.gym) amenitySet.add('gym')
    if (activeFilters.wifi) amenitySet.add('wifi')
    if (activeFilters.parking) amenitySet.add('parking')
    if (activeFilters.airConditioning) amenitySet.add('airConditioning')
    if (activeFilters.heating) amenitySet.add('heating')
    if (activeFilters.balcony) amenitySet.add('balcony')
    if (activeFilters.elevator) amenitySet.add('elevator')
    if (activeFilters.furnished) amenitySet.add('furnished')
    if (activeFilters.petsAllowed) amenitySet.add('petFriendly')
    if (amenitySet.size) {
      Array.from(amenitySet).forEach((amenity: string) => qs.append('amenities', amenity))
    }
    if (activeFilters.sort) qs.set('sort', activeFilters.sort)
    qs.set('page', String(activeFilters.page))
    qs.set('pageSize', String(activeFilters.pageSize))

    const cacheKey = qs.toString()

    // Stale-while-revalidate: si hay un resultado cacheado para estos filtros,
    // mostralo al instante y refrescá en segundo plano (sin spinner de pantalla completa).
    // Esto hace que las propiedades aparezcan al toque aunque Render esté "despertando".
    const cached = readPropertiesCache(cacheKey)
    let showedCache = false
    if (cached) {
      setItems(cached.items)
      setTotal(cached.total)
      setLoading(false)
      showedCache = true
    } else {
      setLoading(true)
    }

    setPropertiesError(null)
    try {
      // retry: ante un cold start de Render, el proxy puede devolver 502/504
      // mientras el servidor "despierta". Reintentamos con backoff en vez de
      // mostrarle un error al usuario (los 4xx y los abortos no se reintentan).
      const data = await api(`/api/properties/with-metrics?${cacheKey}`, { signal: ac.signal, retry: true })
      const apiItems = Array.isArray(data?.items) ? data.items : []
      const apiTotal = Number(data?.total) || 0

      setItems(apiItems)
      setTotal(apiTotal)
      writePropertiesCache(cacheKey, apiItems, apiTotal)
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      // Si ya mostramos datos cacheados, no los borramos: mejor data vieja que pantalla vacía.
      if (!showedCache) {
        setPropertiesError(getErrorMessage(e))
        setItems([])
        setTotal(0)
      }
      if (import.meta.env.DEV) {
        console.warn('Properties API failed:', e.message)
      }
    } finally {
      if (!ac.signal.aborted) {
        setLoading(false)
      }
    }
  }, [filters])

  const handleFilterSearch = useCallback(() => {
    const nextFilters = { ...filters, page: 1 }
    setFilters(nextFilters)
    load(nextFilters)
  }, [filters, load])

  const handleFilterReset = useCallback(() => {
    const resetFilters = { ...DEFAULT_FILTERS }
    setFilters(resetFilters)
    load(resetFilters)
  }, [load])

  const handlePropertyCreated = useCallback(() => {
    load(filters)
  }, [load, filters])

  const openPropertyInitialItem = useMemo(
    () => (openId ? items.find((it) => it.property?.id === openId) ?? null : null),
    [openId, items]
  )

  const canPublishProperty =
    !!user &&
    (user.role === 'broker' || user.role === 'broker_admin' || user.role === 'admin')

  // Cargar propiedades cuando cambian los filtros (ubicación/query con debounce para no disparar en cada tecla)
  useEffect(() => {
    const resetFilters = {
      ...filters,
      location: debouncedLocation,
      query: debouncedQuery,
      page: 1,
    }
    setFilters((prev: any) => ({ ...prev, page: 1 }))
    load(resetFilters)
  }, [
    debouncedLocation,
    debouncedQuery,
    filters.minPrice,
    filters.maxPrice,
    filters.sort,
    filters.bedrooms,
    filters.rooms,
    filters.bathrooms,
    filters.propertyType,
    filters.verified,
    filters.amenities,
    filters.pool,
    filters.gym,
    filters.wifi,
    filters.parking,
    filters.airConditioning,
    filters.heating,
    filters.balcony,
    filters.elevator,
    filters.furnished,
    filters.petsAllowed,
  ])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / filters.pageSize)), [total, filters.pageSize])

  // Función para cargar contadores de notificaciones y mensajes
  const loadCounters = useCallback(async () => {
    if (!token) return
    const opts = { token }
    const [notifRes, msgRes] = await Promise.allSettled([
      api('/api/notifications/unread-count', opts),
      api('/api/chat/unread-count', opts),
    ])
    setNotificationCount(notifRes.status === 'fulfilled' ? notifRes.value.count || 0 : 0)
    setMessageCount(msgRes.status === 'fulfilled' ? msgRes.value.count || 0 : 0)
  }, [token])

  // Contadores: primera carga en idle para no competir con listados; luego cada 30s.
  useEffect(() => {
    if (!token) return

    const run = () => {
      void loadCounters()
    }
    let idleHandle: number | undefined
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined
    if (typeof requestIdleCallback !== 'undefined') {
      idleHandle = requestIdleCallback(run, { timeout: 3000 }) as unknown as number
    } else {
      timeoutHandle = setTimeout(run, 350)
    }
    const interval = setInterval(loadCounters, 30000)
    return () => {
      if (idleHandle !== undefined && typeof cancelIdleCallback !== 'undefined') {
        cancelIdleCallback(idleHandle)
      }
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle)
      clearInterval(interval)
    }
  }, [token, loadCounters])

  const scrollToExplore = useCallback(() => {
    setShowMap(false)
    setMapPinnedForDetail(false)
    setMobileNavTab('explore')
    requestAnimationFrame(() => {
      document.getElementById('rial-explore')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  const goHome = useCallback(() => {
    setShowNotifications(false)
    setShowChat(false)
    setShowPayments(false)
    setShowUserProfile(false)
    setShowAlerts(false)
    setShowAnalytics(false)
    setShowOwnerLeads(false)
    setShowBrokerLeads(false)
    setShowAdminRequests(false)
    setShowCompliancePanel(false)
    setShowComplianceListings(false)
    setShowComplianceIncidents(false)
    setShowComplianceSuspensions(false)
    setShowComplianceAuditLogs(false)
    setShowComparison(false)
    handleClosePropertyDetail()
    setRenterNav('explore')
    setBrokerNav('dashboard')
    scrollToExplore()
  }, [handleClosePropertyDetail, scrollToExplore])

  const handleToggleMapMobile = useCallback(() => {
    setShowMap((prev) => {
      const next = !prev
      setMobileNavTab(next ? 'map' : 'explore')
      if (!next) setMapPinnedForDetail(false)
      return next
    })
  }, [])

  const showMapView = showMap || (mapPinnedForDetail && openId != null)

  // Pantalla de bienvenida: primera pantalla cuando no hay sesión ni modo invitado.
  // Desde acá el usuario inicia sesión, se registra o entra como invitado.
  if (!user && !guestMode) {
    return (
      <>
        <Toaster
          position="top-center"
          containerClassName="!top-[max(0.75rem,env(safe-area-inset-top))] md:!top-4"
          containerStyle={{ zIndex: 2147483647 }}
          toastOptions={{
            duration: 4000,
            style: {
              background: darkMode ? '#0f172a' : '#F5F1E9',
              color: darkMode ? '#f1f5f9' : '#1A1F26',
              border: `1px solid ${darkMode ? '#334155' : '#E8E2D6'}`,
              maxWidth: 'min(92vw, 420px)',
            },
          }}
        />
        <WelcomeScreen
          requires2FA={requires2FA}
          twoFactorMethod={twoFactorMethod}
          onLogin={onLogin}
          onVerify2FA={verify2FA}
          onRegister={onRegister}
          onContinueAsGuest={continueAsGuest}
        />
        <CookieConsent />
      </>
    )
  }

  return (
    <div className="rial-app-shell flex min-h-screen font-sans text-rial-ink transition-colors duration-300 dark:text-slate-100">
      <AppSidebar
        user={user}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        showMap={showMap}
        onToggleMap={handleToggleMapMobile}
        onScrollHome={scrollToExplore}
        notificationCount={notificationCount}
        messageCount={messageCount}
        onOpenNotifications={openNotifications}
        onOpenChat={() => setShowChat(true)}
        onOpenPayments={() => setShowPayments(true)}
        onOpenAlerts={() => setShowAlerts(true)}
        onOpenComparison={() => setShowComparison(true)}
        onOpenProfile={() => setShowUserProfile(true)}
        onOpenOwnerLeads={() => setShowOwnerLeads(true)}
        onOpenBrokerLeads={() => setShowBrokerLeads(true)}
        onOpenAnalytics={() => setShowAnalytics(true)}
        onOpenAdminRequests={() => setShowAdminRequests(true)}
        favoritesSlot={
          user && token ? (
            <Suspense fallback={null}>
              <FavoritesSystem
                token={token}
                user={user}
                onPropertyClick={handleOpenPropertyDetail}
                properties={items}
                rail
              />
            </Suspense>
          ) : null
        }
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <style>{`
        .input{ @apply w-full px-3 py-2 rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-rial-gold focus:border-transparent transition-all duration-200; }
        .btn-primary{ @apply px-4 py-2 rounded-xl bg-rial-navy text-rial-cream hover:bg-rial-navy-light focus:outline-none focus:ring-2 focus:ring-rial-gold focus:ring-offset-2 transition-all duration-200; }
        .btn-secondary{ @apply px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200; }
      `}</style>

      <Toaster
        position="top-center"
        containerClassName="!top-[max(0.75rem,env(safe-area-inset-top))] md:!top-4"
        containerStyle={{
          left: 'max(0.75rem, env(safe-area-inset-left))',
          right: 'max(0.75rem, env(safe-area-inset-right))',
          zIndex: 2147483647,
        }}
        toastOptions={{
          duration: 4000,
          style: {
            background: darkMode ? '#0f172a' : '#F5F1E9',
            color: darkMode ? '#f1f5f9' : '#1A1F26',
            border: `1px solid ${darkMode ? '#334155' : '#E8E2D6'}`,
            maxWidth: 'min(92vw, 420px)',
          },
        }}
      />

      <header className="relative border-b border-rial-gold/40 bg-gradient-to-r from-white/90 via-rial-gold-soft/25 to-white/90 px-3 py-3 shadow-sm shadow-rial-accent/10 backdrop-blur-md dark:border-rial-accent/20 dark:from-slate-950/95 dark:via-rial-navy/40 dark:to-slate-950/95 sm:px-4 md:px-6 md:py-5">
        <div className="rial-accent-bar absolute inset-x-0 top-0 opacity-80" aria-hidden />
        <div className="mx-auto flex max-w-6xl flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-4">
          <div className="flex min-w-0 items-center justify-between gap-2 md:justify-start">
            <RialBrand
              name={t('app.name')}
              tagline={t('app.tagline')}
              size="header"
              showLabel={false}
              showTagline={false}
              surface={darkMode ? 'dark' : 'light'}
              className="min-w-0 shrink"
              onClick={goHome}
              clickLabel={t('app.logoHome')}
            />
            <div className="flex shrink-0 items-center gap-1.5 md:hidden">
              {user && (
                <button
                  type="button"
                  onClick={openNotifications}
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-rial-gold/35 bg-white/90 text-rial-navy dark:border-slate-600 dark:bg-slate-800 dark:text-rial-cream"
                  aria-label={t('app.sidebar.notifications')}
                >
                  <Bell className="h-5 w-5" />
                  {notificationCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                  )}
                </button>
              )}
              <select
                value={getAppLanguage()}
                onChange={(e) => setAppLanguage(e.target.value)}
                className="h-10 max-w-[5.5rem] rounded-xl border border-rial-cream-dark/60 bg-white px-2 py-1 text-xs text-rial-ink focus:outline-none focus:ring-2 focus:ring-rial-gold dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                title={t('profile.language')}
                aria-label={t('profile.language')}
              >
                <option value="es">{t('profile.spanish')}</option>
                <option value="en">{t('profile.english')}</option>
              </select>
            </div>
          </div>
          <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 md:w-auto">
            <Globe className="hidden h-4 w-4 shrink-0 text-rial-muted dark:text-slate-400 md:block" aria-hidden />
            <select
              value={getAppLanguage()}
              onChange={(e) => setAppLanguage(e.target.value)}
              className="hidden rounded-xl border border-rial-cream-dark/60 bg-white px-3 py-2 text-sm text-rial-ink focus:border-transparent focus:outline-none focus:ring-2 focus:ring-rial-gold dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 md:block"
              title={t('profile.language')}
              aria-label={t('profile.language')}
            >
              <option value="es">{t('profile.spanish')}</option>
              <option value="en">{t('profile.english')}</option>
            </select>
            <div className="min-w-0 w-full max-w-full md:max-w-xl">
              <AuthPanel
                user={user}
                token={token}
                requires2FA={requires2FA}
                twoFactorMethod={twoFactorMethod}
                onLogin={onLogin}
                onVerify2FA={verify2FA}
                onLogout={handleLogout}
                onRegister={onRegister}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Navegación por rol: renta / broker / compliance */}
      {user && (
        <nav className="w-full min-w-0 overflow-hidden border-b border-rial-gold/30 bg-gradient-to-r from-rial-sky/40 via-white/70 to-rial-sky/40 dark:border-rial-accent/15 dark:from-slate-900/60 dark:via-slate-900/40 dark:to-slate-900/60">
          <div className="mx-auto w-full min-w-0 max-w-6xl space-y-2 px-3 py-2 md:px-4">
          {user.role === 'tenant' && (
            <RoleNavStrip
              items={[
                { key: 'explore', label: t('nav.renter.explore') },
                { key: 'saved', label: t('nav.renter.saved') },
                { key: 'messages', label: t('nav.renter.messages') },
                { key: 'showings', label: t('nav.renter.showings') },
                { key: 'documents', label: t('nav.renter.documents') },
                { key: 'applications', label: t('nav.renter.applications') },
                { key: 'profile', label: t('nav.renter.profile') },
              ]}
              value={renterNav}
              mobileAriaLabel={t('app.roleNav.renter')}
              onChange={(key) => {
                const k = key as RenterNavKey
                setRenterNav(k)
                if (k === 'saved') {
                  scrollToExplore()
                  toast(t('app.sidebar.favorites'), { icon: '❤️' })
                } else if (k === 'messages') {
                  setShowChat(true)
                } else if (k === 'showings') {
                  toast.success(t('nav.renter.showingsPending'))
                } else if (k === 'documents') {
                  toast.success(t('nav.renter.documentsPending'))
                } else if (k === 'applications' || k === 'profile') {
                  setShowUserProfile(true)
                }
              }}
            />
          )}

          {(user.role === 'broker' || user.role === 'broker_admin' || user.role === 'admin') && (
            <RoleNavStrip
              items={[
                { key: 'dashboard', label: t('nav.broker.dashboard') },
                { key: 'leads', label: t('nav.broker.leads') },
                { key: 'listings', label: t('nav.broker.listings') },
                { key: 'calendar', label: t('nav.broker.calendar') },
                { key: 'brokerDocuments', label: t('nav.broker.documents') },
                { key: 'brokerMessages', label: t('nav.broker.messages') },
                { key: 'analytics', label: t('nav.broker.analytics') },
                { key: 'team', label: t('nav.broker.team') },
                { key: 'settings', label: t('nav.broker.settings') },
              ]}
              value={brokerNav}
              mobileAriaLabel={t('app.roleNav.broker')}
              onChange={(key) => {
                const k = key as BrokerNavKey
                setBrokerNav(k)
                if (k === 'leads') {
                  setShowBrokerLeads(true)
                } else if (k === 'listings') {
                  setShowBrokerListings(true)
                } else if (k === 'brokerMessages') {
                  setShowChat(true)
                } else if (k === 'analytics') {
                  setShowAnalytics(true)
                }
              }}
            />
          )}

          {(user.role === 'compliance_admin' || user.role === 'admin') && (
            <RoleNavStrip
              className={user.role === 'admin' ? 'border-t border-rial-gold/20 pt-2 dark:border-slate-700/80' : undefined}
              items={[
                { key: 'brokerVerifications', label: t('nav.compliance.brokerVerifications') },
                { key: 'listingsReview', label: t('nav.compliance.listingsReview') },
                { key: 'reports', label: t('nav.compliance.reports') },
                { key: 'flags', label: t('nav.compliance.flags') },
                { key: 'suspensions', label: t('nav.compliance.suspensions') },
                { key: 'auditLogs', label: t('nav.compliance.auditLogs') },
              ]}
              value={complianceNav}
              mobileAriaLabel={t('app.roleNav.compliance')}
              onChange={(key) => {
                const k = key as ComplianceNavKey
                setComplianceNav(k)
                if (k === 'brokerVerifications') {
                  setShowCompliancePanel(true)
                  setShowComplianceListings(false)
                  setShowComplianceIncidents(false)
                  setShowComplianceSuspensions(false)
                  setShowComplianceAuditLogs(false)
                } else if (k === 'listingsReview') {
                  setShowComplianceListings(true)
                  setShowCompliancePanel(false)
                  setShowComplianceIncidents(false)
                  setShowComplianceSuspensions(false)
                  setShowComplianceAuditLogs(false)
                } else if (k === 'flags') {
                  setShowComplianceIncidents(true)
                  setShowCompliancePanel(false)
                  setShowComplianceListings(false)
                  setShowComplianceSuspensions(false)
                  setShowComplianceAuditLogs(false)
                } else if (k === 'suspensions') {
                  setShowComplianceSuspensions(true)
                  setShowCompliancePanel(false)
                  setShowComplianceListings(false)
                  setShowComplianceIncidents(false)
                  setShowComplianceAuditLogs(false)
                } else if (k === 'auditLogs') {
                  setShowComplianceAuditLogs(true)
                  setShowCompliancePanel(false)
                  setShowComplianceListings(false)
                  setShowComplianceIncidents(false)
                  setShowComplianceSuspensions(false)
                }
              }}
            />
          )}
          </div>
        </nav>
      )}

      <main className="mx-auto max-w-6xl flex-1 space-y-5 px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] pt-1 sm:space-y-6 sm:px-4 md:pb-16 md:pt-0">
        <div id="rial-explore">
        <Suspense fallback={<LoadingSpinner text={t('app.loadingFilters')} />}>
          <AdvancedFilters
            filters={filters}
            setFilters={setFilters}
            onSearch={handleFilterSearch}
            onReset={handleFilterReset}
            showMap={showMap}
            onToggleMap={handleToggleMapMobile}
          />
        </Suspense>
        </div>

        {canPublishProperty && (
          <Suspense fallback={null}>
            <CreatePropertyForm token={token} currentUser={user} onCreated={handlePropertyCreated} />
          </Suspense>
        )}

        <motion.div 
          className="flex items-center justify-between"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-sm text-gray-600 dark:text-gray-400">{total} {t('app.results')}</div>
          <div className="flex gap-2 items-center">
            <Button
              variant="outline"
              disabled={filters.page <= 1}
              onClick={() => {
                const p = Math.max(1, filters.page - 1)
                const nextFilters = { ...filters, page: p }
                setFilters(nextFilters)
                load(nextFilters)
              }}
            >
              {t('app.previous')}
            </Button>
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('app.page')} {filters.page} / {totalPages}</div>
            <Button
              variant="outline"
              disabled={filters.page >= totalPages}
              onClick={() => {
                const p = Math.min(totalPages, filters.page + 1)
                const nextFilters = { ...filters, page: p }
                setFilters(nextFilters)
                load(nextFilters)
              }}
            >
              {t('app.next')}
            </Button>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" text={t('app.loadingProperties')} />
          </div>
        ) : propertiesError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">
            {propertiesError}
          </div>
        ) : showMapView ? (
          <div className="overflow-hidden rounded-2xl h-[min(65dvh,420px)] md:h-[min(70vh,640px)]">
            {(() => {
              const validProperties = items
                .filter((item) => Boolean(item?.property))
                .map((item, index) => {
                  const normalized = normalizeGeoProperty(item.property, index)
                  return {
                    ...normalized,
                    averageRating: item.averageRating ?? 0,
                    reviewsCount: item.reviewsCount ?? 0,
                    isAvailable: item.isAvailable
                  }
                })
              
              // Calcular centro basado en las propiedades
              const validCoords = validProperties.filter(p => 
                typeof p.latitude === 'number' && typeof p.longitude === 'number' &&
                !isNaN(p.latitude) && !isNaN(p.longitude)
              )
              
              let mapCenter = mapViewport
                ? { lat: mapViewport.lat, lng: mapViewport.lng }
                : MOCK_CENTER
              if (!mapViewport && validCoords.length > 0) {
                const avgLat = validCoords.reduce((sum, p) => sum + p.latitude, 0) / validCoords.length
                const avgLng = validCoords.reduce((sum, p) => sum + p.longitude, 0) / validCoords.length
                mapCenter = { lat: avgLat, lng: avgLng }
              }

              const mapZoom = mapViewport?.zoom ?? (validCoords.length > 1 ? 10 : 12)
              
              return (
                <Suspense fallback={<LoadingSpinner text={t('app.loadingProperties')} />}>
                  <InteractiveMap
                    properties={validProperties}
                    center={mapCenter}
                    zoom={mapZoom}
                    savedViewport={mapViewport}
                    onViewportChange={handleMapViewportChange}
                    onPropertyClick={(property) => handleOpenPropertyDetail(property.id)}
                    onLocationSelect={() => {}}
                  />
                </Suspense>
              )
            })()}
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
          >
            <AnimatePresence>
              {items.map((it) => (
                <PropertyCard
                  key={it.property.id}
                  item={it}
                  onOpen={() => handleOpenPropertyDetail(it.property.id)}
                  token={token}
                  user={user}
                  comparisonIds={comparisonIds}
                  onAddToComparison={handleAddToComparison}
                  onRemoveFromComparison={handleRemoveFromComparison}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Paginación inferior */}
        {!loading && items.length > 0 && (
          <motion.div 
            className="mt-8 flex flex-col gap-3 border-t border-gray-200 pt-6 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-sm text-gray-600 dark:text-gray-400">{total} {t('app.results')}</div>
            <div className="flex gap-2 items-center">
              <Button
                variant="outline"
                disabled={filters.page <= 1}
                onClick={() => {
                  const p = Math.max(1, filters.page - 1)
                  const nextFilters = { ...filters, page: p }
                  setFilters(nextFilters)
                  load(nextFilters)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                {t('app.previous')}
              </Button>
              <div className="text-sm text-gray-600 dark:text-gray-400">{t('app.page')} {filters.page} / {totalPages}</div>
              <Button
                variant="outline"
                disabled={filters.page >= totalPages}
                onClick={() => {
                  const p = Math.min(totalPages, filters.page + 1)
                  const nextFilters = { ...filters, page: p }
                  setFilters(nextFilters)
                  load(nextFilters)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                {t('app.next')}
              </Button>
            </div>
          </motion.div>
        )}
      </main>

      {/* Asistente IA flotante (marca RIAL: navy + celeste) — solo con sesión iniciada */}
      {typeof document !== 'undefined' &&
        user &&
        !showChat &&
        createPortal(
          <motion.button
            type="button"
            onClick={() => setShowChat(true)}
            className="pointer-events-auto fixed z-[60000] flex max-w-[min(20rem,calc(100vw-1.25rem))] items-center gap-2 rounded-2xl border border-rial-gold/45 bg-rial-navy px-3 py-2.5 text-sm font-medium text-rial-cream shadow-xl transition-colors hover:bg-rial-navy-light focus:outline-none focus-visible:ring-2 focus-visible:ring-rial-gold bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] right-[max(0.75rem,env(safe-area-inset-right,0px))] md:bottom-5 md:right-4 md:gap-3 md:px-5 md:py-3.5 dark:focus-visible:ring-offset-slate-950"
            style={{
              boxShadow: '0 12px 36px -10px rgba(11, 22, 35, 0.55)',
            }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            title={t('app.assistantFabTitle')}
          >
            <Sparkles className="h-5 w-5 shrink-0 text-rial-gold" aria-hidden />
            <span className="hidden min-w-0 truncate sm:inline">{t('app.assistantFabLabel')}</span>
          </motion.button>,
          document.body
        )}

      </div>

      <MobileBottomNav
        user={user}
        showMap={showMap}
        activeTab={mobileNavTab}
        messageCount={messageCount}
        notificationCount={notificationCount}
        onExplore={scrollToExplore}
        onToggleMap={handleToggleMapMobile}
        onFavorites={() => {
          if (!user) {
            toast.error(t('app.sidebar.loginRequired'))
            return
          }
          setMobileNavTab('favorites')
          scrollToExplore()
          toast.success(t('app.sidebar.favorites'))
        }}
        onMessages={() => {
          if (!user) {
            toast.error(t('app.sidebar.loginRequired'))
            return
          }
          setMobileNavTab('messages')
          setShowChat(true)
        }}
        onProfile={() => {
          setMobileNavTab('profile')
          if (user) setShowUserProfile(true)
        }}
      />

      <CookieConsent />

      <AnimatePresence>
        {openId && (
          <PropertyDetail
            id={openId}
            initialItem={openPropertyInitialItem}
            onClose={handleClosePropertyDetail}
            token={token}
            user={user}
          />
        )}
        {showChat && (
        <Suspense fallback={<LoadingSpinner text={t('app.loadingAssistant')} />}>
          <AIAssistant 
            isOpen={showChat}
            properties={fullListForAssistant} 
            onClose={() => setShowChat(false)} 
            onPropertyClick={(id) => {
              setShowChat(false)
              handleOpenPropertyDetail(id)
            }}
            onSearchFiltersChange={(partial) => {
              // Ajustar filtros globales desde la IA y recargar resultados
              const nextFilters = {
                ...filters,
                location: partial.location ?? filters.location,
                minPrice: partial.minPrice != null ? String(partial.minPrice) : filters.minPrice,
                maxPrice: partial.maxPrice != null ? String(partial.maxPrice) : filters.maxPrice,
                bedrooms: partial.bedrooms != null ? String(partial.bedrooms) : filters.bedrooms,
                bathrooms: partial.bathrooms != null ? String(partial.bathrooms) : filters.bathrooms,
                petsAllowed: partial.petsAllowed ?? filters.petsAllowed,
                furnished: partial.furnished ?? filters.furnished,
                parking: partial.parking ?? filters.parking,
                page: 1,
              }
              setFilters(nextFilters)
              load(nextFilters)
            }}
            // De momento, para solicitudes de visita o pre-calificación desde el chat,
            // abrimos la ficha de la propiedad; el usuario puede usar desde allí
            // "Solicitar visita con broker" o "Revisar elegibilidad".
            onRequestVisit={(propertyId) => {
              setShowChat(false)
              handleOpenPropertyDetail(propertyId)
            }}
            onStartPrequalification={(propertyId) => {
              setShowChat(false)
              handleOpenPropertyDetail(propertyId)
            }}
          />
        </Suspense>
        )}
        {showPayments && (
          <Suspense fallback={<LoadingSpinner text={t('app.loadingPayments')} />}>
            <PaymentPanel token={token} user={user} onClose={() => setShowPayments(false)} />
          </Suspense>
        )}
        {/* Retorno desde Stripe Checkout: muestra el estado de la reserva tras pagar */}
        <AnimatePresence>
          {stripeReturn && token && (
            <motion.div
              className="fixed inset-0 bg-black/40 backdrop-blur flex items-center justify-center p-4 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setStripeReturn(null)}
            >
              <motion.div
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-end mb-1">
                  <button
                    type="button"
                    onClick={() => setStripeReturn(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    aria-label={t('reservation.close')}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <Suspense fallback={<LoadingSpinner text={t('reservation.verifyingPayment')} />}>
                  <ReservationPaymentStep
                    reservationId={stripeReturn.reservationId}
                    token={token}
                    notice={stripeReturn.notice}
                    sessionId={stripeReturn.sessionId}
                    autoRefresh
                  />
                </Suspense>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        {showAlerts && (
          <Suspense fallback={<LoadingSpinner text={t('app.loadingAlerts')} />}>
            <AlertSystem token={token} user={user} onClose={() => setShowAlerts(false)} />
          </Suspense>
        )}
        {showAnalytics && (
          <Suspense fallback={<LoadingSpinner text={t('app.loadingAnalytics')} />}>
            <AnalyticsDashboard token={token} user={user} onClose={() => setShowAnalytics(false)} />
          </Suspense>
        )}
        {showOwnerLeads && token && (
          <Suspense fallback={<LoadingSpinner text={t('ownerLeads.title')} />}>
            <OwnerLeadsPanel token={token} onClose={() => setShowOwnerLeads(false)} />
          </Suspense>
        )}
        {showBrokerLeads && token && (
          <Suspense fallback={<LoadingSpinner text={t('app.loadingBrokerLeadsPipeline')} />}>
            <BrokerLeadsDashboard token={token} user={user} onClose={() => setShowBrokerLeads(false)} />
          </Suspense>
        )}
        {showBrokerListings && token && (
          <Suspense fallback={<LoadingSpinner text={t('brokerListings.loading')} />}>
            <BrokerListingsPanel token={token} onClose={() => setShowBrokerListings(false)} />
          </Suspense>
        )}
        {showCompliancePanel && token && (
          <Suspense fallback={<LoadingSpinner text={t('app.loadingBrokerVerifications')} />}>
            <ComplianceBrokerVerificationsPanel token={token} onClose={() => setShowCompliancePanel(false)} />
          </Suspense>
        )}
        {showComplianceListings && token && (
          <Suspense fallback={<LoadingSpinner text={t('app.loadingListingsReview')} />}>
            <ComplianceListingsReviewPanel token={token} onClose={() => setShowComplianceListings(false)} />
          </Suspense>
        )}
        {showComplianceIncidents && token && (
          <Suspense fallback={<LoadingSpinner text={t('app.loadingIncidents')} />}>
            <ComplianceIncidentsPanel token={token} onClose={() => setShowComplianceIncidents(false)} />
          </Suspense>
        )}
        {showComplianceSuspensions && token && (
          <Suspense fallback={<LoadingSpinner text={t('app.loadingSuspensions')} />}>
            <ComplianceSuspensionsPanel token={token} onClose={() => setShowComplianceSuspensions(false)} />
          </Suspense>
        )}
        {showComplianceAuditLogs && token && (
          <Suspense fallback={<LoadingSpinner text={t('app.loadingAuditLogs')} />}>
            <ComplianceAuditLogsPanel token={token} onClose={() => setShowComplianceAuditLogs(false)} />
          </Suspense>
        )}
        <AnimatePresence>
          {showAdminRequests && token && (
            <Suspense fallback={null}>
              <AdminRequestsPanel
                token={token}
                onClose={() => setShowAdminRequests(false)}
                onApproved={() => {}}
              />
            </Suspense>
          )}
        </AnimatePresence>
        {showComparison && (
          <Suspense fallback={<LoadingSpinner text={t('app.loadingComparator')} />}>
            <PropertyComparator 
              token={token} 
              user={user} 
              onClose={() => setShowComparison(false)}
              selectedIds={comparisonIds}
              onSelectIds={handleComparisonIdsChange}
              properties={comparisonItems.length > 0 ? comparisonItems : items}
            />
          </Suspense>
        )}
        {showUserProfile && user && (
          <Suspense fallback={<LoadingSpinner text={t('app.loadingProfile')} />}>
            <UserProfile
              user={{
                id: user.id,
                name: user.name,
                email: user.email,
                role:
                  user.role === 'owner' || user.role === 'admin' || user.role === 'tenant'
                    ? user.role
                    : 'tenant',
                verified: Boolean(user.verified),
                emailVerified: Boolean(user.emailVerified),
                joinDate: user.joinDate || user.createdAt || new Date().toISOString(),
                preferences: {
                  notifications: { email: true, push: true, sms: false },
                  privacy: { profileVisible: true, showEmail: false, showPhone: false },
                  theme: 'auto',
                  language: 'es',
                },
                stats: {
                  totalProperties: 0,
                  totalReviews: 0,
                  averageRating: 0,
                  totalBookings: 0,
                  totalFavorites: 0,
                  totalMessages: 0,
                },
              }}
              token={token}
              onUpdate={(data) => {
                updateUser(data)
              }}
              onLogout={handleLogout}
              onClose={() => setShowUserProfile(false)}
              properties={items}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {showNotifications && (
              <NotificationPanel
                key="notification-panel"
                token={token}
                user={user}
                onClose={() => setShowNotifications(false)}
              />
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  )
}

