import React, { useEffect, useMemo, useState, useCallback, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'react-hot-toast'
import { setAppLanguage, getAppLanguage } from './i18n'
import { 
  Bell, 
  MessageCircle, 
  CreditCard, 
  Sun, 
  Moon, 
  Search, 
  MapPin, 
  DollarSign, 
  Star, 
  Heart, 
  Share2, 
  Calendar,
  Users,
  Home,
  Bed,
  Bath,
  Settings,
  LogOut,
  X,
  Check,
  Send,
  Info,
  User,
  AlertTriangle,
  BarChart3,
  GitCompare,
  Shield,
  Globe,
  Sparkles
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
// Lazy loading de componentes pesados para mejorar el rendimiento inicial
const FavoritesSystem = lazy(() => import('./components/FavoritesSystem').then(m => ({ default: m.FavoritesSystem })))
const AdvancedFilters = lazy(() => import('./components/AdvancedFilters').then(m => ({ default: m.AdvancedFilters })))
const ImageGallery = lazy(() => import('./components/ImageGallery').then(m => ({ default: m.ImageGallery })))
const PhotoTour = lazy(() => import('./components/PhotoTour').then(m => ({ default: m.PhotoTour })))
const InteractiveMap = lazy(() => import('./components/InteractiveMap').then(m => ({ default: m.InteractiveMap })))
const UserProfile = lazy(() => import('./components/UserProfile').then(m => ({ default: m.UserProfile })))
const AlertSystem = lazy(() => import('./components/AlertSystem').then(m => ({ default: m.AlertSystem })))
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard })))
const VerificationSystem = lazy(() => import('./components/VerificationSystem').then(m => ({ default: m.VerificationSystem })))
const PropertyComparator = lazy(() => import('./components/PropertyComparator').then(m => ({ default: m.PropertyComparator })))
const AIAssistant = lazy(() => import('./components/AIAssistant').then(m => ({ default: m.AIAssistant })))
const RentalProcess = lazy(() => import('./components/RentalProcess').then(m => ({ default: m.RentalProcess })))
const PurchaseProcess = lazy(() => import('./components/PurchaseProcess').then(m => ({ default: m.PurchaseProcess })))
const CreatePropertyForm = lazy(() => import('./components/CreatePropertyForm').then(m => ({ default: m.CreatePropertyForm })))
const NotificationPanel = lazy(() => import('./components/NotificationPanel').then(m => ({ default: m.NotificationPanel })))
const PaymentPanel = lazy(() => import('./components/PaymentPanel').then(m => ({ default: m.PaymentPanel })))
const AdminRequestsPanel = lazy(() => import('./components/AdminRequestsPanel').then(m => ({ default: m.AdminRequestsPanel })))
const OwnerLeadsPanel = lazy(() => import('./components/OwnerLeadsPanel').then(m => ({ default: m.OwnerLeadsPanel })))
const BrokerLeadsDashboard = lazy(() => import('./components/BrokerLeadsDashboard').then(m => ({ default: m.BrokerLeadsDashboard })))
const ComplianceBrokerVerificationsPanel = lazy(() => import('./components/ComplianceBrokerVerificationsPanel').then(m => ({ default: m.ComplianceBrokerVerificationsPanel })))
const ComplianceListingsReviewPanel = lazy(() => import('./components/ComplianceListingsReviewPanel').then(m => ({ default: m.ComplianceListingsReviewPanel })))
const ComplianceIncidentsPanel = lazy(() => import('./components/ComplianceIncidentsPanel').then(m => ({ default: m.ComplianceIncidentsPanel })))
const ComplianceSuspensionsPanel = lazy(() => import('./components/ComplianceSuspensionsPanel').then(m => ({ default: m.ComplianceSuspensionsPanel })))
const ComplianceAuditLogsPanel = lazy(() => import('./components/ComplianceAuditLogsPanel').then(m => ({ default: m.ComplianceAuditLogsPanel })))
const ScheduleVisit = lazy(() => import('./components/ScheduleVisit').then(m => ({ default: m.ScheduleVisit })))

// Componentes críticos cargados normalmente (necesarios para el render inicial)
import { AuthPanel } from './components/AuthPanel'
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

const MOCK_CENTER = { lat: -34.6037, lng: -58.3816 }

// Función eliminada - ahora usamos directamente getMockProperties

function normalizeGeoProperty(property: any, index: number) {
  const lat = typeof property.latitude === 'number' ? property.latitude : MOCK_CENTER.lat + index * 0.01
  const lng = typeof property.longitude === 'number' ? property.longitude : MOCK_CENTER.lng + index * 0.01
  return { ...property, latitude: lat, longitude: lng }
}

// Función api movida a ./utils/api.ts para reutilización



function FiltersBar({ filters, setFilters, onSearch }: any) {
  const { t } = useTranslation()
  return (
    <motion.div 
      className="p-4 rounded-2xl bg-white/70 dark:bg-gray-800/70 shadow-lg backdrop-blur-sm border border-white/20"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="grid md:grid-cols-5 gap-3">
        <Input 
          placeholder={t('filters.location')} 
          value={filters.location} 
          onChange={(value) => setFilters({ ...filters, location: value })}
          icon={<MapPin className="w-4 h-4" />}
        />
        <Input 
          type="number"
          placeholder={t('filters.minPrice')} 
          value={filters.minPrice} 
          onChange={(value) => setFilters({ ...filters, minPrice: value })}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <Input 
          type="number"
          placeholder={t('filters.maxPrice')} 
          value={filters.maxPrice} 
          onChange={(value) => setFilters({ ...filters, maxPrice: value })}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <select 
          className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
          value={filters.sort} 
          onChange={e => setFilters({ ...filters, sort: e.target.value })}
        >
          <option value="">{t('filters.sort')}</option>
          <option value="price_asc">{t('filters.sortPriceAsc')}</option>
          <option value="price_desc">{t('filters.sortPriceDesc')}</option>
        </select>
        <Button onClick={onSearch} className="w-full" icon={<Search className="w-4 h-4" />}>
          {t('filters.search')}
        </Button>
      </div>
    </motion.div>
  )
}


function PropertyDetail({ id, onClose, token, user }: any) {
  const { t, i18n } = useTranslation()
  const [summary, setSummary] = useState<PropertySummary | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [review, setReview] = useState({ rating: 5 as any, comment: '' })
  const [showRentalProcess, setShowRentalProcess] = useState(false)
  const [showPurchaseProcess, setShowPurchaseProcess] = useState(false)
  const [showScheduleVisit, setShowScheduleVisit] = useState(false)
  const [duplicateAlerts, setDuplicateAlerts] = useState<Array<{ id: number; similarityScore: number; suspectedDuplicateOf?: { id: number; title: string; location?: string } }>>([])
  const canReview = Boolean(user)

  useEffect(() => {
    let mounted = true
    setSummary(null)
    setLoadError(false)
    ;(async () => {
      try {
        const data = await api(`/api/properties/${id}/summary`)
        if (mounted) setSummary(data || null)
      } catch (error) {
        if (!mounted) return
        setLoadError(true)
      }
    })()
    return () => {
      mounted = false
    }
  }, [id])

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
        className="fixed inset-0 bg-black/40 backdrop-blur flex items-center justify-center p-4 z-50"
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
      <motion.div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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

  const statCards = [
    { label: t('propertyDetail.monthlyPrice'), value: `${formatMoney(property.price)} ${t('propertyDetail.perMonth')}` },
    { label: t('propertyDetail.rooms'), value: `${property.rooms ?? property.bedrooms} ${t('propertyDetail.roomsShort')}` },
    { label: t('propertyDetail.bedrooms'), value: `${property.bedrooms} ${t('propertyDetail.bedroomsShort')}` },
    { label: t('propertyDetail.bathrooms'), value: `${property.bathrooms} ${t('propertyDetail.bathroomsShort')}` },
    { label: t('propertyDetail.beds'), value: `${property.beds}` },
    { label: t('propertyDetail.area'), value: `${property.area} m²` },
    { label: t('propertyDetail.parking'), value: property.parking ? `${property.parking}` : t('propertyDetail.noParking') },
    { label: t('propertyDetail.propertyType'), value: property.type },
    { label: t('propertyDetail.availability'), value: property.availableNow ? t('propertyDetail.availableNow') : t('propertyDetail.comingSoon') }
  ]

  const amenityGroups = [
    { title: t('propertyDetail.insideApt'), items: property.amenities || [] },
    { title: t('propertyDetail.buildingAmenities'), items: property.buildingAmenities || [] },
    { title: t('propertyDetail.security'), items: property.safety || [] }
  ]

  const detailFacts = [
    { label: t('propertyDetail.neighborhood'), value: property.neighborhood },
    { label: t('propertyDetail.city'), value: `${property.city}, ${property.country}` },
    { label: t('propertyDetail.totalRooms'), value: `${property.rooms ?? property.bedrooms}` },
    { label: t('propertyDetail.yearBuilt'), value: property.yearBuilt },
    { label: t('propertyDetail.deposit'), value: formatMoney(property.deposit) },
    { label: t('propertyDetail.expenses'), value: property.hoa ? formatMoney(property.hoa) : t('propertyDetail.included') },
    { label: t('propertyDetail.modality'), value: property.availableFor?.map((mode: string) => (mode === 'buy' ? t('propertyDetail.modalityBuy') : t('propertyDetail.modalityRent'))).join(' · ') || t('common.consult') }
  ]

  const broker = (property as any).broker

  return (
    <motion.div 
      className="fixed inset-0 bg-black/40 backdrop-blur flex items-center justify-center p-4 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div 
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start gap-4 mb-6">
          <div className="space-y-2">
            <div>
              <p className="text-sm uppercase tracking-wide text-blue-500 font-semibold">{property.subtitle}</p>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{property.title}</h2>
              <div className="text-gray-600 dark:text-gray-400 flex items-center mt-1">
                <MapPin className="w-4 h-4 mr-1" />
                {property.location}
              </div>
            </div>
            <div className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center">
                  <Star className="w-4 h-4 text-yellow-500 fill-current mr-1" />
                  {averageRating.toFixed(1)} · {reviewsCount} {t('propertyDetail.reviewsCount')}
                </span>
                <span
                  className={classNames(
                    'inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full font-semibold',
                    isAvailable
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300'
                  )}
                >
                  {isAvailable ? t('common.available') : t('common.reserved')}
                </span>
              </div>
              {broker?.isVerifiedBroker && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 font-semibold">
                    <Shield className="w-3 h-3" />
                    Listed by verified broker
                  </span>
                  {broker.name && <span>· {broker.name}</span>}
                  {broker.brokerageName && <span>· {broker.brokerageName}</span>}
                  {broker.licenseState && (
                    <span className="text-[11px] opacity-80">
                      License: {broker.licenseType ? `${broker.licenseType} · ` : ''}
                      {broker.licenseState}
                      {broker.licenseExpiration && ` · exp. ${new Date(broker.licenseExpiration).toLocaleDateString()}`}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <Button variant="outline" onClick={onClose} icon={<X className="w-4 h-4" />}>
            {t('propertyDetail.close')}
          </Button>
        </div>

        <motion.div 
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Suspense fallback={<LoadingSpinner text={t('app.loadingGallery')} />}>
            <ImageGallery
              images={property.images || []}
              title={property.title}
            />
          </Suspense>
        </motion.div>

        {property.images?.length > 0 && (
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t('propertyDetail.photoTour')}
            </p>
            <Suspense fallback={<div className="w-full aspect-video rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse" />}>
              <PhotoTour images={property.images} title={property.title} />
            </Suspense>
          </motion.div>
        )}

        <motion.div 
          className="grid md:grid-cols-4 gap-3 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          {statCards.map((card, idx) => (
            <div key={`stat-${idx}-${card.label || 'label'}`} className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/70 border border-gray-100 dark:border-gray-600">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">{card.label}</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{card.value}</p>
            </div>
          ))}
        </motion.div>

        <motion.div 
          className="grid md:grid-cols-3 gap-6 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="md:col-span-2 space-y-4">
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {i18n.language === 'en' && (property as any).descriptionEn
                ? (property as any).descriptionEn
                : property.description}
            </p>
            {!!property.highlights?.length && (
              <div className="flex flex-wrap gap-2">
                {property.highlights
                  .filter((highlight: string) => Boolean(highlight && highlight.trim()))
                  .map((highlight: string, idx: number) => (
                  <span key={`highlight-${idx}-${highlight}`} className="text-xs font-medium px-3 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                    {highlight}
                  </span>
                ))}
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              {detailFacts.map((fact, idx) => (
                <div key={`fact-${idx}-${fact.label || 'label'}`} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/60 border border-gray-100 dark:border-gray-600">
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{fact.label}</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{fact.value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700 space-y-4">
            <div>
              <p className="text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">{t('propertyDetail.contractOptions')}</p>
              {rentAvailable && (
                <div className="mb-3">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">{formatMoney(property.price)} {t('propertyDetail.perMonth')}</div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('propertyDetail.deposit')}: {formatMoney(property.deposit)} · {t('propertyDetail.expenses')}: {property.hoa ? formatMoney(property.hoa) : t('propertyDetail.included')}</p>
                </div>
              )}
              {buyAvailable && (
                <div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">{formatMoney(property.salePrice)}</div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('propertyDetail.buyDirectOrLeasing')}</p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {rentAvailable && (
                <Button 
                  icon={<CreditCard className="w-4 h-4" />}
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
              {buyAvailable && (
                <Button
                  variant="secondary"
                  icon={<Home className="w-4 h-4" />}
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
                icon={<Calendar className="w-4 h-4" />}
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
        </motion.div>

        <motion.div 
          className="grid md:grid-cols-3 gap-4 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          {amenityGroups.map((group, groupIdx) => (
            <div key={`amenity-group-${groupIdx}-${group.title || 'group'}`} className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/70 border border-gray-100 dark:border-gray-600">
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
                    className="flex-shrink-0 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:ring-inset focus:outline-none transition-colors"
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
      
      {/* Proceso de Alquiler Virtual */}
      <AnimatePresence>
        {showRentalProcess && summary && summary.property && (
          <Suspense fallback={<LoadingSpinner text={t('app.loadingProcess')} />}>
            <RentalProcess
              property={summary.property}
              user={user}
              token={token}
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
              token={token}
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
              token={token}
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

function ChatPanel({ token, user, onClose }: any) {
  const { t } = useTranslation()
  const [conversations, setConversations] = useState<any[]>([])
  const [selectedConversation, setSelectedConversation] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      loadConversations()
    }
  }, [token])

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.userId)
    }
  }, [selectedConversation])

  async function loadConversations() {
    try {
      const data = await api('/api/chat/conversations', { token })
      setConversations(data)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  async function loadMessages(userId: number) {
    try {
      const data = await api(`/api/chat/messages/${userId}`, { token })
      setMessages(data)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedConversation) return

    try {
      const message = await api('/api/chat/send', {
        method: 'POST',
        token,
        body: {
          receiverId: selectedConversation.userId,
          content: newMessage
        }
      })
      setMessages(prev => [...prev, message])
      setNewMessage('')
      loadConversations() // Refresh conversations to update last message
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  if (!user) return null

  return (
    <motion.div 
      className="fixed inset-0 bg-black/40 backdrop-blur flex items-center justify-center p-4 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div 
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b">
          <div className="font-semibold text-lg text-gray-900 dark:text-white">{t('chat.title')}</div>
          <Button variant="outline" onClick={onClose} icon={<X className="w-4 h-4" />}>
            {t('chat.close')}
          </Button>
        </div>

        <motion.div 
          className="flex flex-1 overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <motion.div 
            className="w-1/3 border-r overflow-y-auto"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="p-4">
              <div className="font-medium mb-2 text-gray-900 dark:text-white">{t('chat.conversations')}</div>
              {loading ? (
                <div className="text-center text-gray-500 dark:text-gray-400">{t('chat.loading')}</div>
              ) : conversations.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400">{t('chat.none')}</div>
              ) : (
                conversations.map((conv, idx) => (
                  <motion.div
                    key={`conv-${idx}-${conv.userId || conv.userEmail || 'unknown'}`}
                    onClick={() => setSelectedConversation(conv)}
                    className={classNames(
                      'p-3 rounded-xl cursor-pointer mb-2',
                      selectedConversation?.userId === conv.userId ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    )}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: conversations.indexOf(conv) * 0.05 }}
                  >
                    <div className="font-medium text-gray-900 dark:text-white">{conv.userName}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 truncate">{conv.lastMessage}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(conv.lastMessageTime).toLocaleString()}
                      {conv.unreadCount > 0 && (
                        <span className="ml-2 bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>

          {/* Mensajes */}
          <motion.div 
            className="flex-1 flex flex-col"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            {selectedConversation ? (
              <>
                <div className="p-4 border-b">
                  <div className="font-medium text-gray-900 dark:text-white">{selectedConversation.userName}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{selectedConversation.userEmail}</div>
                </div>

                <motion.div 
                  className="flex-1 overflow-y-auto p-4 space-y-2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  {messages.map((message, idx) => (
                    <motion.div
                      key={`msg-${idx}-${message.id || message.createdAt || 'unknown'}`}
                      className={classNames(
                        'max-w-[70%] p-3 rounded-xl',
                        message.senderId === user.id
                          ? 'ml-auto bg-blue-500 text-white dark:bg-blue-600'
                          : 'bg-gray-100 dark:bg-gray-700'
                      )}
                      initial={{ opacity: 0, x: message.senderId === user.id ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: messages.indexOf(message) * 0.05 }}
                    >
                      <div className="text-sm">{message.content}</div>
                      <div className={classNames(
                        'text-xs mt-1',
                        message.senderId === user.id ? 'text-blue-100 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'
                      )}>
                        {new Date(message.createdAt).toLocaleString()}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>

                <motion.div 
                  className="p-4 border-t"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={newMessage}
                      onChange={(value) => setNewMessage(value)}
                      placeholder={t('chat.writeMessage')}
                      icon={<Search className="w-4 h-4" />}
                    />
                    <Button onClick={sendMessage} icon={<Send className="w-4 h-4" />}>
                      {t('chat.send')}
                    </Button>
                  </div>
                </motion.div>
              </>
            ) : (
              <motion.div 
                className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                {t('chat.selectConversation')}
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}



export default function App() {
  const { t } = useTranslation()
  const { token, user, requires2FA, twoFactorMethod, onLogin, verify2FA, onRegister, onLogout, updateUser } = useAuth()

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

  const handleClosePropertyDetail = useCallback(() => {
    setOpenId(null)
    const url = new URL(window.location.href)
    if (url.searchParams.has('property')) {
      url.searchParams.delete('property')
      window.history.replaceState({}, '', url.pathname + (url.search || ''))
    }
  }, [])

  // Nuevos estados para las funcionalidades
  const [showNotifications, setShowNotifications] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showPayments, setShowPayments] = useState(false)
  const [showFavorites, setShowFavorites] = useState(false)
  const [showUserProfile, setShowUserProfile] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [showAlerts, setShowAlerts] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showOwnerLeads, setShowOwnerLeads] = useState(false)
  const [showBrokerLeads, setShowBrokerLeads] = useState(false)
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

  const loadAssistantCatalog = useCallback(async () => {
    if (!token) {
      setAssistantCatalog([])
      return
    }
    try {
      const pageSize = 200
      let page = 1
      let totalPages = 1
      const allRows: any[] = []

      do {
        const data = await api(`/api/ai/property-catalog?verified=true&page=${page}&pageSize=${pageSize}`, { token })
        const rows = Array.isArray(data?.items) ? data.items : []
        allRows.push(...rows)
        totalPages = Number(data?.totalPages) || 1
        page += 1
      } while (page <= totalPages)

      const uniqueById = Array.from(
        new Map(allRows.map((p: any) => [p.id, p])).values()
      )
      setAssistantCatalog(uniqueById)
    } catch {
      setAssistantCatalog([])
    }
  }, [token])

  const load = useCallback(async (customFilters?: any) => {
    const activeFilters = customFilters ? { ...customFilters } : { ...filters }
    // Asegurar que page y pageSize tengan valores por defecto
    activeFilters.page = activeFilters.page || 1
    activeFilters.pageSize = activeFilters.pageSize || 12
    
    setLoading(true)
    setPropertiesError(null)
    try {
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
      
      const data = await api(`/api/properties/with-metrics?${qs.toString()}`)
      const apiItems = Array.isArray(data?.items) ? data.items : []
      const apiTotal = Number(data?.total) || 0

      setItems(apiItems)
      setTotal(apiTotal)
      if (token && assistantCatalog.length === 0) {
        loadAssistantCatalog()
      }
    } catch (e: any) {
      setPropertiesError(getErrorMessage(e))
      setItems([])
      setTotal(0)
      if (import.meta.env.DEV) {
        console.warn('Properties API failed:', e.message)
      }
    } finally {
      setLoading(false)
    }
  }, [assistantCatalog.length, filters, loadAssistantCatalog, t, token])

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

  useEffect(() => {
    loadAssistantCatalog()
  }, [loadAssistantCatalog])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / filters.pageSize)), [total, filters.pageSize])

  // Función para cargar contadores de notificaciones y mensajes
  const loadCounters = useCallback(async () => {
    if (!token) return
    
    try {
      // Cargar contador de notificaciones
      try {
        const notificationsRes = await api('/api/notifications/unread-count', { token })
        setNotificationCount(notificationsRes.count || 0)
      } catch (error) {
        // Si falla, mantener el contador en 0
        setNotificationCount(0)
      }

      // Cargar contador de mensajes
      try {
        const messagesRes = await api('/api/chat/unread-count', { token })
        setMessageCount(messagesRes.count || 0)
      } catch (error) {
        // Si falla, mantener el contador en 0
        setMessageCount(0)
      }
    } catch (error) {
      console.error('Error loading counters:', error)
      // En caso de error, mantener los contadores en 0
      setNotificationCount(0)
      setMessageCount(0)
    }
  }, [token])

  // Cargar contadores de notificaciones y mensajes
  useEffect(() => {
    if (token) {
      loadCounters()
      const interval = setInterval(loadCounters, 30000) // Actualizar cada 30 segundos
      return () => clearInterval(interval)
    }
  }, [token, loadCounters])



  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 text-slate-900 dark:text-white transition-colors duration-300`}>
      <style>{`
        .input{ @apply w-full px-3 py-2 rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200; }
        .btn-primary{ @apply px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200; }
        .btn-secondary{ @apply px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200; }
      `}</style>

      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: darkMode ? '#374151' : '#fff',
            color: darkMode ? '#fff' : '#000',
            border: `1px solid ${darkMode ? '#4B5563' : '#E5E7EB'}`,
          },
        }}
      />

      <header className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
        <motion.div 
          className="flex items-center gap-3"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <img
            src="/rial-logo.png"
            alt="RIAL - Real Estate AI"
            className="h-12 w-12 rounded-full object-cover"
          />
          <div>
            <div className="font-semibold text-xl text-gray-900 dark:text-white">{t('app.name')}</div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('app.tagline')}</p>
          </div>
        </motion.div>
        
        <div className="flex items-center gap-4">
          {user && (
            <>
              <motion.button 
                onClick={() => setShowNotifications(true)}
                className="relative p-2 rounded-xl bg-white/70 dark:bg-gray-800/70 hover:bg-white/90 dark:hover:bg-gray-700/90 transition-all duration-200 shadow-lg backdrop-blur-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Bell className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                {notificationCount > 0 && (
                  <motion.span 
                    className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    {notificationCount}
                  </motion.span>
                )}
              </motion.button>
              
              <motion.button 
                onClick={() => setShowChat(true)}
                className="relative p-2 rounded-xl bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-900/30 dark:to-violet-900/30 hover:from-indigo-100 hover:to-violet-100 dark:hover:from-indigo-800/40 dark:hover:to-violet-800/40 transition-all duration-200 shadow-lg backdrop-blur-sm border border-indigo-200/50 dark:border-indigo-700/50"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Asistente virtual - ¿Necesitas ayuda?"
              >
                <MessageCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                {messageCount > 0 && (
                  <motion.span 
                    className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    {messageCount}
                  </motion.span>
                )}
              </motion.button>
              
              <motion.button 
                onClick={() => setShowPayments(true)}
                className="p-2 rounded-xl bg-white/60 dark:bg-gray-800/60 hover:bg-white/80 dark:hover:bg-gray-700/80 transition-all duration-200 border border-dashed border-gray-200 dark:border-gray-700"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <CreditCard className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </motion.button>

              <Suspense fallback={null}>
                <FavoritesSystem 
                  token={token} 
                  user={user} 
                  onPropertyClick={(id) => setOpenId(id)}
                  properties={items}
                />
              </Suspense>

              <motion.button 
                onClick={() => setShowAlerts(true)}
                className="p-2 rounded-xl bg-white/70 dark:bg-gray-800/70 hover:bg-white/90 dark:hover:bg-gray-700/90 transition-all duration-200 shadow-lg backdrop-blur-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title={t('alerts.title')}
              >
                <AlertTriangle className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </motion.button>

              {(user?.role === 'owner' || user?.role === 'admin') && (
                <>
                  <motion.button 
                onClick={() => {
                  if (user?.role === 'broker' || user?.role === 'broker_admin') {
                    setShowBrokerLeads(true)
                  } else {
                    setShowOwnerLeads(true)
                  }
                }}
                    className="p-2 rounded-xl bg-white/70 dark:bg-gray-800/70 hover:bg-white/90 dark:hover:bg-gray-700/90 transition-all duration-200 shadow-lg backdrop-blur-sm"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    title={t('ownerLeads.title')}
                  >
                    <Users className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  </motion.button>
                  <motion.button 
                    onClick={() => setShowAnalytics(true)}
                    className="p-2 rounded-xl bg-white/70 dark:bg-gray-800/70 hover:bg-white/90 dark:hover:bg-gray-700/90 transition-all duration-200 shadow-lg backdrop-blur-sm"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    title={t('analytics.title')}
                  >
                    <BarChart3 className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  </motion.button>
                </>
              )}
              {user?.role === 'admin' && (
                <motion.button 
                  onClick={() => setShowAdminRequests(true)}
                  className="p-2 rounded-xl bg-white/70 dark:bg-gray-800/70 hover:bg-white/90 dark:hover:bg-gray-700/90 transition-all duration-200 shadow-lg backdrop-blur-sm"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title={t('adminRequests.title')}
                >
                  <Shield className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </motion.button>
              )}

              <motion.button 
                onClick={() => setShowComparison(true)}
                className="p-2 rounded-xl bg-white/70 dark:bg-gray-800/70 hover:bg-white/90 dark:hover:bg-gray-700/90 transition-all duration-200 shadow-lg backdrop-blur-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title={t('comparator.title')}
              >
                <GitCompare className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </motion.button>

              <motion.button 
                onClick={() => setShowUserProfile(true)}
                className="p-2 rounded-xl bg-white/70 dark:bg-gray-800/70 hover:bg-white/90 dark:hover:bg-gray-700/90 transition-all duration-200 shadow-lg backdrop-blur-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <User className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </motion.button>

              <motion.button 
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-xl bg-white/70 dark:bg-gray-800/70 hover:bg-white/90 dark:hover:bg-gray-700/90 transition-all duration-200 shadow-lg backdrop-blur-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {darkMode ? <Sun className="w-5 h-5 text-gray-700 dark:text-gray-300" /> : <Moon className="w-5 h-5 text-gray-700 dark:text-gray-300" />}
              </motion.button>
            </>
          )}

          {/* Selector de idioma: siempre visible para poder cambiar antes de iniciar sesión o registrarse */}
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-gray-600 dark:text-gray-400" aria-hidden />
            <select
              value={getAppLanguage()}
              onChange={(e) => setAppLanguage(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              title={t('profile.language')}
              aria-label={t('profile.language')}
            >
              <option value="es">{t('profile.spanish')}</option>
              <option value="en">{t('profile.english')}</option>
            </select>
          </div>
          
          <div className="w-full max-w-xl">
            <AuthPanel 
              user={user} 
              token={token} 
              requires2FA={requires2FA}
              twoFactorMethod={twoFactorMethod}
              onLogin={onLogin} 
              onVerify2FA={verify2FA}
              onLogout={onLogout} 
              onRegister={onRegister} 
            />
          </div>
        </div>
      </header>

      {/* Navegación por rol: renta / broker / compliance */}
      {user && (
        <nav className="max-w-6xl mx-auto px-4 pb-3">
          {user.role === 'tenant' && (
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                { key: 'explore', label: t('nav.renter.explore') },
                { key: 'saved', label: t('nav.renter.saved') },
                { key: 'messages', label: t('nav.renter.messages') },
                { key: 'showings', label: t('nav.renter.showings') },
                { key: 'documents', label: t('nav.renter.documents') },
                { key: 'applications', label: t('nav.renter.applications') },
                { key: 'profile', label: t('nav.renter.profile') },
              ].map((item) => (
                <button
                  key={item.key}
                  className={classNames(
                    'px-3 py-1 rounded-full border text-xs',
                    renterNav === item.key
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white/70 dark:bg-gray-800/70 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700'
                  )}
                  onClick={() => {
                    const k = item.key as RenterNavKey
                    setRenterNav(k)
                    // Conectar con vistas/modales existentes
                    if (k === 'saved') {
                      setShowFavorites(true)
                    } else if (k === 'messages') {
                      setShowChat(true)
                    } else if (k === 'showings') {
                      toast.success(t('nav.renter.showingsPending'))
                    } else if (k === 'documents') {
                      toast.success(t('nav.renter.documentsPending'))
                    } else if (k === 'applications') {
                      setShowUserProfile(true)
                    } else if (k === 'profile') {
                      setShowUserProfile(true)
                    }
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {(user.role === 'broker' || user.role === 'broker_admin') && (
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                { key: 'dashboard', label: t('nav.broker.dashboard') },
                { key: 'leads', label: t('nav.broker.leads') },
                { key: 'listings', label: t('nav.broker.listings') },
                { key: 'calendar', label: t('nav.broker.calendar') },
                { key: 'brokerDocuments', label: t('nav.broker.documents') },
                { key: 'brokerMessages', label: t('nav.broker.messages') },
                { key: 'analytics', label: t('nav.broker.analytics') },
                { key: 'team', label: t('nav.broker.team') },
                { key: 'settings', label: t('nav.broker.settings') },
              ].map((item) => (
                <button
                  key={item.key}
                  className={classNames(
                    'px-3 py-1 rounded-full border text-xs',
                    brokerNav === item.key
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white/70 dark:bg-gray-800/70 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700'
                  )}
                  onClick={() => {
                    const k = item.key as BrokerNavKey
                    setBrokerNav(k)
                    if (k === 'leads') {
                      setShowBrokerLeads(true)
                    } else if (k === 'listings') {
                      // Scroll a sección principal de listings (explore)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    } else if (k === 'brokerMessages') {
                      setShowChat(true)
                    } else if (k === 'analytics') {
                      setShowAnalytics(true)
                    }
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {(user.role === 'compliance_admin' || user.role === 'admin') && (
            <div className="flex flex-wrap gap-2 text-xs mt-2">
              {[
                { key: 'brokerVerifications', label: t('nav.compliance.brokerVerifications') },
                { key: 'listingsReview', label: t('nav.compliance.listingsReview') },
                { key: 'reports', label: t('nav.compliance.reports') },
                { key: 'flags', label: t('nav.compliance.flags') },
                { key: 'suspensions', label: t('nav.compliance.suspensions') },
                { key: 'auditLogs', label: t('nav.compliance.auditLogs') },
              ].map((item) => (
                <button
                  key={item.key}
                  className={classNames(
                    'px-3 py-1 rounded-full border text-xs',
                    complianceNav === item.key
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white/70 dark:bg-gray-800/70 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700'
                  )}
                  onClick={() => {
                    const k = item.key as ComplianceNavKey
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
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </nav>
      )}

      <main className="max-w-6xl mx-auto px-4 pb-16 space-y-6">
        <Suspense fallback={<LoadingSpinner text={t('app.loadingFilters')} />}>
          <AdvancedFilters
            filters={filters}
            setFilters={setFilters}
            onSearch={useCallback(() => {
              const nextFilters = { ...filters, page: 1 }
              setFilters(nextFilters)
              load(nextFilters)
            }, [filters, load, setFilters])}
            onReset={useCallback(() => {
              const resetFilters = { ...DEFAULT_FILTERS }
              setFilters(resetFilters)
              load(resetFilters)
            }, [load, setFilters])}
            showMap={showMap}
            onToggleMap={useCallback(() => setShowMap(!showMap), [showMap])}
          />
        </Suspense>

        <Suspense fallback={null}>
          <CreatePropertyForm token={token} currentUser={user} onCreated={useCallback(() => load(filters), [load, filters])} />
        </Suspense>

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
        ) : showMap ? (
          <div className="h-[600px] rounded-2xl overflow-hidden">
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
              
              let mapCenter = MOCK_CENTER
              if (validCoords.length > 0) {
                const avgLat = validCoords.reduce((sum, p) => sum + p.latitude, 0) / validCoords.length
                const avgLng = validCoords.reduce((sum, p) => sum + p.longitude, 0) / validCoords.length
                mapCenter = { lat: avgLat, lng: avgLng }
              }
              
              return (
                <Suspense fallback={<LoadingSpinner text={t('app.loadingProperties')} />}>
                  <InteractiveMap
                    properties={validProperties}
                    center={mapCenter}
                    zoom={validCoords.length > 1 ? 10 : 12}
                    onPropertyClick={(property) => setOpenId(property.id)}
                    onLocationSelect={(lat, lng) => {
                      console.log('Location selected:', lat, lng)
                    }}
                  />
                </Suspense>
              )
            })()}
          </div>
        ) : (
          <motion.div 
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
            layout
          >
            <AnimatePresence>
              {items.map((it, index) => (
                <motion.div
                  key={it.property.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <PropertyCard 
                    item={it} 
                    onOpen={() => setOpenId(it.property.id)} 
                    token={token}
                    user={user}
                    comparisonIds={comparisonIds}
                    onAddToComparison={handleAddToComparison}
                    onRemoveFromComparison={handleRemoveFromComparison}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Paginación inferior */}
        {!loading && items.length > 0 && (
          <motion.div 
            className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700"
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

      {/* Botón flotante del Asistente IA - visible y fácil de encontrar */}
      {user && !showChat && (
        <motion.button
          onClick={() => setShowChat(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border-0 text-white font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400"
          style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
            boxShadow: '0 10px 40px -10px rgba(99, 102, 241, 0.5), 0 0 0 1px rgba(255,255,255,0.1) inset'
          }}
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8 }}
          whileHover={{ scale: 1.05, boxShadow: '0 14px 50px -10px rgba(99, 102, 241, 0.6)' }}
          whileTap={{ scale: 0.98 }}
          title="Abrir asistente virtual"
        >
          <span className="relative flex">
            <Sparkles className="w-6 h-6" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" aria-hidden />
          </span>
          <span className="hidden sm:inline">¿Necesitas ayuda?</span>
        </motion.button>
      )}

      <AnimatePresence>
        {openId && <PropertyDetail id={openId} onClose={handleClosePropertyDetail} token={token} user={user} />}
        {showNotifications && (
          <Suspense fallback={<LoadingSpinner text={t('app.loadingNotifications')} />}>
            <NotificationPanel token={token} user={user} onClose={() => setShowNotifications(false)} />
          </Suspense>
        )}
        <Suspense fallback={<LoadingSpinner text={t('app.loadingAssistant')} />}>
          <AIAssistant 
            isOpen={showChat}
            properties={fullListForAssistant} 
            onClose={() => setShowChat(false)} 
            onPropertyClick={(id) => {
              setShowChat(false)
              setOpenId(id)
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
              setOpenId(propertyId)
            }}
            onStartPrequalification={(propertyId) => {
              setShowChat(false)
              setOpenId(propertyId)
            }}
          />
        </Suspense>
        {showPayments && (
          <Suspense fallback={<LoadingSpinner text={t('app.loadingPayments')} />}>
            <PaymentPanel token={token} user={user} onClose={() => setShowPayments(false)} />
          </Suspense>
        )}
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
        {showUserProfile && (
          <Suspense fallback={<LoadingSpinner text={t('app.loadingProfile')} />}>
            <UserProfile 
              user={{
                id: user?.id || 1,
                name: user?.name || 'Usuario',
                email: user?.email || 'usuario@email.com',
                role: user?.role || 'tenant',
                verified: false,
                joinDate: new Date().toISOString(),
                preferences: {
                  notifications: { email: true, push: true, sms: false },
                  privacy: { profileVisible: true, showEmail: false, showPhone: false },
                  theme: 'auto',
                  language: 'es'
                },
                stats: {
                  totalProperties: 0,
                  totalReviews: 0,
                  averageRating: 0,
                  totalBookings: 0,
                  totalFavorites: 0,
                  totalMessages: 0
                }
              }}
              token={token}
              onUpdate={(data) => {
                console.log('User updated:', data)
                updateUser(data)
              }}
              onLogout={onLogout}
              onClose={() => setShowUserProfile(false)}
              properties={items}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  )
}

