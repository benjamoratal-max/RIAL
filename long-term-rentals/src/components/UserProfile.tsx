import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { setAppLanguage } from '../i18n'
import { 
  User, 
  Settings, 
  Activity, 
  Heart, 
  Calendar, 
  Star, 
  MessageCircle, 
  Bell, 
  CreditCard, 
  Shield, 
  Camera, 
  Edit, 
  Save, 
  X, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Eye,
  EyeOff,
  Download,
  Share2,
  Phone,
  MapPin,
  Globe,
  Clock,
  Award,
  BadgeCheck,
  FileText,
  Lock,
  Unlock,
  Home
} from 'lucide-react'
import { Button, Input, LoadingSpinner, classNames } from './UI'
import { LeadApplicationReadiness } from './LeadApplicationReadiness'
import { api } from '../utils/api'
import { VerificationSystem } from './VerificationSystem'
import { PhoneInput } from './PhoneInput'
import { EmailVerification } from './EmailVerification'
import { TwoFactorAuth } from './TwoFactorAuth'

interface UserProfileData {
  id: number
  name: string
  email: string
  phone?: string
  avatar?: string
  role: 'tenant' | 'owner' | 'admin'
  verified: boolean
  emailVerified?: boolean
  joinDate: string
  preferences: {
    notifications: {
      email: boolean
      push: boolean
      sms: boolean
    }
    privacy: {
      profileVisible: boolean
      showEmail: boolean
      showPhone: boolean
    }
    theme: 'light' | 'dark' | 'auto'
    language: string
  }
  stats: {
    totalProperties: number
    totalReviews: number
    averageRating: number
    totalBookings: number
    totalFavorites: number
    totalMessages: number
  }
}

interface UserProfileProps {
  user: UserProfileData
  token: string
  onUpdate: (data: Partial<UserProfileData>) => void
  onLogout: () => void
  onClose?: () => void
  properties?: any[] // Propiedades disponibles para construir favoritos
}

export function UserProfile({ user, token, onUpdate, onLogout, onClose, properties = [] }: UserProfileProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'dashboard' | 'profile' | 'activity' | 'applications' | 'settings' | 'security'>('dashboard')
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState(user)
  const [activities, setActivities] = useState<any[]>([])
  const [favorites, setFavorites] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [renterLeads, setRenterLeads] = useState<any[]>([])
  const [selectedLeadForDocs, setSelectedLeadForDocs] = useState<any | null>(null)

  useEffect(() => {
    // Actualizar editData cuando cambie el prop user
    setEditData(user)
  }, [user])

  useEffect(() => {
    loadUserData()
    
    // Escuchar cambios en favoritos
    const handleFavoritesUpdate = () => {
      loadFavorites()
    }
    window.addEventListener('favoritesUpdated', handleFavoritesUpdate)
    
    return () => {
      window.removeEventListener('favoritesUpdated', handleFavoritesUpdate)
    }
  }, [properties])

  const loadUserData = async () => {
    setLoading(true)
    try {
      // Simular carga de datos
      await Promise.all([
        loadActivities(),
        loadFavorites(),
        loadBookings(),
        loadReviews(),
        loadRenterLeads(),
      ])
    } catch (error) {
      console.error('Error loading user data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadRenterLeads = async () => {
    if (!token || user.role !== 'tenant') {
      setRenterLeads([])
      return
    }
    try {
      const data = await api('/api/leads/mine', { token })
      setRenterLeads(Array.isArray(data?.items) ? data.items : [])
    } catch (error) {
      console.error('Error loading renter leads:', error)
      // Evitamos mostrar toast en la carga de perfil para no interrumpir UX de Settings/Profile
      setRenterLeads([])
    }
  }

  const loadActivities = async () => {
    // Simular actividades
    const mockActivities = [
      {
        id: 1,
        type: 'booking',
        title: t('profile.activityBookingConfirmedTitle'),
        description: t('profile.activityBookingConfirmedDescription'),
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        icon: Calendar
      },
      {
        id: 2,
        type: 'review',
        title: t('profile.activityReviewPublishedTitle'),
        description: t('profile.activityReviewPublishedDescription'),
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        icon: Star
      },
      {
        id: 3,
        type: 'favorite',
        title: t('profile.activityFavoriteAddedTitle'),
        description: t('profile.activityFavoriteAddedDescription'),
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        icon: Heart
      }
    ]
    setActivities(mockActivities)
  }

  const loadFavorites = async () => {
    // Cargar favoritos reales desde localStorage
    try {
      const stored = localStorage.getItem('rial_favorites')
      const favoriteIds: number[] = stored ? JSON.parse(stored) : []
      
      if (favoriteIds.length === 0 || !properties || properties.length === 0) {
        setFavorites([])
        return
      }

      // Construir favoritos completos desde las propiedades disponibles
      const favoriteProperties = favoriteIds
        .map(id => {
          const propertyItem = properties.find((item: any) => 
            item.property?.id === id || item.id === id
          )
          
          if (!propertyItem) return null

          const prop = propertyItem.property || propertyItem
          return {
            id: id,
            property: {
              id: prop.id,
              title: prop.title || t('profile.untitledProperty'),
              price: prop.price || 0,
              location: prop.location || t('profile.locationUnavailable'),
              images: prop.images || [],
              averageRating: propertyItem.averageRating || 0,
              reviewsCount: propertyItem.reviewsCount || 0
            },
            addedAt: new Date() // No tenemos fecha exacta desde localStorage
          }
        })
        .filter((f): f is any => f !== null)

      setFavorites(favoriteProperties)
      
      // Actualizar estadÃ­sticas localmente y en el componente padre
      const updatedStats = {
        ...user.stats,
        totalFavorites: favoriteProperties.length
      }
      setEditData({
        ...editData,
        stats: updatedStats
      })
      onUpdate({
        stats: updatedStats
      })
    } catch (error) {
      console.error('Error loading favorites:', error)
      setFavorites([])
    }
  }

  const loadBookings = async () => {
    // Simular reservas
    const mockBookings = [
      {
        id: 1,
        property: {
          id: 1,
          title: 'Apartamento Centro',
          price: 1200,
          location: 'Centro de la ciudad'
        },
        startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        status: 'confirmed'
      }
    ]
    setBookings(mockBookings)
  }

  const loadReviews = async () => {
    // Simular reseÃ±as
    const mockReviews = [
      {
        id: 1,
        property: {
          id: 1,
          title: 'Casa Playa'
        },
        rating: 5,
        comment: 'Excelente ubicaciÃ³n y muy limpia',
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      }
    ]
    setReviews(mockReviews)
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      await onUpdate(editData)
      setIsEditing(false)
    } catch (error) {
      console.error('Error updating profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'dashboard', labelKey: 'profile.dashboard', icon: Activity },
    { id: 'profile', labelKey: 'profile.profileTab', icon: User },
    { id: 'activity', labelKey: 'profile.activity', icon: Calendar },
    user.role === 'tenant'
      ? { id: 'applications', labelKey: 'profile.applications', icon: FileText }
      : null,
    { id: 'settings', labelKey: 'profile.settings', icon: Settings },
    { id: 'security', labelKey: 'profile.security', icon: Shield }
  ].filter(Boolean) as Array<{ id: string; labelKey: string; icon: any }>

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose()
        }
      }}
    >
      <motion.div
        className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header con botÃ³n de cerrar */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('profile.myProfile')}</h2>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              icon={<X className="w-5 h-5" />}
            >
              {t('profile.close')}
            </Button>
          )}
        </div>
        
        {/* Contenido con scroll */}
        <div className="overflow-y-auto flex-1 p-6">
      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-rial-cream-dark/40 bg-white/90 p-6 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/85">
            {/* InformaciÃ³n del usuario */}
            <div className="text-center mb-6">
              <div className="relative inline-block mb-4">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-rial-navy to-rial-navy-light text-2xl font-bold text-rial-cream ring-2 ring-rial-gold/50">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </div>
                {user.verified && (
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <BadgeCheck className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
              
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{user.name}</h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">{user.email}</p>
              
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className={classNames(
                  'px-2 py-1 rounded-full text-xs font-medium',
                  user.role === 'admin' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                  user.role === 'owner' ? 'bg-rial-cream-dark/70 text-rial-navy dark:bg-slate-700 dark:text-rial-gold' :
                  'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                )}>
                  {user.role === 'admin' ? t('auth.roleAdmin') : user.role === 'owner' ? t('auth.roleOwner') : t('auth.roleTenant')}
                </span>
                {!user.verified && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab('security')}
                    icon={<AlertTriangle className="w-3 h-3" />}
                  >
                    {t('profile.verify')}
                  </Button>
                )}
              </div>
              
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('profile.memberSince')} {new Date(user.joinDate).toLocaleDateString()}
              </p>
            </div>

            {/* NavegaciÃ³n */}
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={classNames(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200',
                      activeTab === tab.id
                        ? 'bg-rial-navy text-rial-cream shadow-lg ring-1 ring-rial-gold/30'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-rial-cream-dark/40 dark:hover:bg-slate-800'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{t(tab.labelKey)}</span>
                  </button>
                )
              })}
            </nav>

            {/* BotÃ³n de cerrar sesiÃ³n */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={onLogout}
                className="w-full"
                icon={<X className="w-4 h-4" />}
              >
                {t('profile.logout')}
              </Button>
            </div>
          </div>
        </div>

        {/* Contenido principal */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-rial-cream-dark/40 bg-white/90 p-6 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/85">
            {loading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" text={t('app.loadingProfile')} />
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {activeTab === 'dashboard' && (
                  <motion.div
                    key="dashboard"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <DashboardTab user={editData} activities={activities} favorites={favorites} />
                  </motion.div>
                )}
                
                {activeTab === 'profile' && (
                  <motion.div
                    key="profile"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <ProfileTab 
                      user={user} 
                      editData={editData} 
                      setEditData={setEditData}
                      isEditing={isEditing}
                      setIsEditing={setIsEditing}
                      onSave={handleSave}
                    />
                  </motion.div>
                )}
                
                {activeTab === 'activity' && (
                  <motion.div
                    key="activity"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <ActivityTab activities={activities} favorites={favorites} bookings={bookings} reviews={reviews} />
                  </motion.div>
                )}
                
                {activeTab === 'applications' && user.role === 'tenant' && (
                  <motion.div
                    key="applications"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {t('profile.applications')}
                    </h2>
                    {renterLeads.length === 0 ? (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('profile.noApplicationsYet')}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {renterLeads.map((lead) => (
                          <div
                            key={lead.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-rial-cream-dark/40 bg-white/95 px-4 py-3 dark:border-slate-600 dark:bg-slate-900/80"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                {lead.property?.title || t('profile.untitledProperty')}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {lead.property?.location || t('profile.locationUnavailable')}
                              </div>
                              {lead.stage && (
                                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-rial-cream-dark/50 px-2 py-0.5 text-[11px] font-semibold text-rial-navy dark:bg-slate-800 dark:text-rial-gold">
                                  {lead.stage}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {lead.broker?.name && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
                                  {t('profile.brokerLabel')}: {lead.broker.name}
                                </span>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedLeadForDocs(lead)}
                              >
                                {t('profile.viewDocuments')}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
                
                {activeTab === 'settings' && (
                  <motion.div
                    key="settings"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <SettingsTab user={user} onUpdate={onUpdate} />
                  </motion.div>
                )}
                
                {activeTab === 'security' && (
                  <motion.div
                    key="security"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <SecurityTab user={user} onUpdate={onUpdate} token={token} />
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
        </div>
        
        {/* Modal de Application Readiness para renter */}
        <AnimatePresence>
          {selectedLeadForDocs && (
            <LeadApplicationReadiness
              token={token}
              leadId={selectedLeadForDocs.id}
              role="renter"
              onClose={() => setSelectedLeadForDocs(null)}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

// Componente Dashboard
function DashboardTab({ user, activities, favorites }: { user: UserProfileData, activities: any[], favorites: any[] }) {
  const { t } = useTranslation()
  const stats = [
    { label: t('profile.statsProperties'), value: user.stats.totalProperties, icon: Home, color: 'slate' },
    { label: t('profile.statsReviews'), value: user.stats.totalReviews, icon: Star, color: 'yellow' },
    { label: t('profile.statsBookings'), value: user.stats.totalBookings, icon: Calendar, color: 'green' },
    { label: t('profile.statsFavorites'), value: favorites.length, icon: Heart, color: 'red' } // Usar el array directamente
  ]

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('profile.dashboard')}</h2>
        
        {/* EstadÃ­sticas */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon
            return (
              <motion.div
                key={`profile-stat-${index}-${stat.label || 'label'}`}
                className="rounded-xl bg-gradient-to-r from-rial-cream to-rial-cream-dark/50 p-4 dark:from-slate-800 dark:to-slate-700/90"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 bg-${stat.color}-100 dark:bg-${stat.color}-900 rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 text-${stat.color}-600 dark:text-${stat.color}-400`} />
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Favoritos recientes */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500" />
            {t('profile.myFavorites')}
          </h3>
          {favorites.length === 0 ? (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-8 text-center">
              <Heart className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">{t('profile.noFavoritesYet')}</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                {t('profile.noFavoritesHint')}
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {favorites.slice(0, 6).map((favorite, index) => (
                <motion.div
                  key={`favorite-card-${index}-${favorite.id || favorite.property?.id || 'unknown'}`}
                  className="bg-white dark:bg-gray-700 rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  {favorite.property?.images?.[0] ? (
                    <img
                      src={favorite.property.images[0]}
                      alt={favorite.property.title}
                      className="w-full h-40 object-cover"
                    />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-rial-cream-dark/50 to-rial-cream-dark/20 dark:from-slate-700 dark:to-slate-600">
                      <Home className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                  <div className="p-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-1">
                      {favorite.property?.title || t('profile.untitledProperty')}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span className="line-clamp-1">{favorite.property?.location || t('profile.locationUnavailable')}</span>
                    </p>
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        ${favorite.property?.price?.toLocaleString() || 0}{t('propertyCard.perMonth')}
                      </p>
                      {favorite.property?.averageRating && (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {favorite.property.averageRating.toFixed(1)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Actividad reciente */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('profile.recentActivity')}</h3>
          <div className="space-y-3">
            {activities.length === 0 ? (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 text-center">
                <p className="text-gray-600 dark:text-gray-400">{t('profile.noRecentActivity')}</p>
              </div>
            ) : (
              activities.slice(0, 5).map((activity, index) => {
                const Icon = activity.icon
                return (
                  <motion.div
                    key={activity.id}
                    className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rial-cream-dark/50 dark:bg-slate-800">
                      <Icon className="h-5 w-5 text-rial-navy dark:text-rial-gold" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">{activity.title}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{activity.description}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {activity.date.toLocaleDateString()}
                      </p>
                    </div>
                  </motion.div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// Componente Perfil
function ProfileTab({ user, editData, setEditData, isEditing, setIsEditing, onSave }: {
  user: UserProfileData
  editData: UserProfileData
  setEditData: (data: UserProfileData) => void
  isEditing: boolean
  setIsEditing: (editing: boolean) => void
  onSave: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('profile.profileTab')}</h2>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)} icon={<X className="w-4 h-4" />}>
                {t('common.close')}
              </Button>
              <Button onClick={onSave} icon={<Save className="w-4 h-4" />}>
                {t('profile.save')}
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)} icon={<Edit className="w-4 h-4" />}>
              {t('profile.edit')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Nombre completo
          </label>
          {isEditing ? (
            <Input
              value={editData.name}
              onChange={(value) => setEditData({ ...editData, name: value })}
              placeholder="Tu nombre"
            />
          ) : (
            <p className="text-gray-900 dark:text-white">{user.name}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Email
          </label>
          {isEditing ? (
            <Input
              value={editData.email}
              onChange={(value) => setEditData({ ...editData, email: value })}
              placeholder="tu@email.com"
            />
          ) : (
            <p className="text-gray-900 dark:text-white">{user.email}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            TelÃ©fono
          </label>
          {isEditing ? (
            <PhoneInput
              value={editData.phone || ''}
              onChange={(value) => setEditData({ ...editData, phone: value })}
              placeholder="NÃºmero de telÃ©fono"
            />
          ) : (
            <p className="text-gray-900 dark:text-white">{user.phone || 'No especificado'}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Rol
          </label>
          <p className="text-gray-900 dark:text-white capitalize">{user.role}</p>
        </div>
      </div>
    </>
  )
}

// Componente Actividad
function ActivityTab({ activities, favorites, bookings, reviews }: {
  activities: any[]
  favorites: any[]
  bookings: any[]
  reviews: any[]
}) {
  const { t } = useTranslation()
  const [activeSection, setActiveSection] = useState<'all' | 'favorites' | 'bookings' | 'reviews'>('all')

  const sections = [
    { id: 'all', label: 'Todas', count: activities.length },
    { id: 'favorites', label: 'Favoritos', count: favorites.length },
    { id: 'bookings', label: 'Reservas', count: bookings.length },
    { id: 'reviews', label: 'ReseÃ±as', count: reviews.length }
  ]

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('profile.activity')}</h2>
        
        {/* Filtros */}
        <div className="flex gap-2 mb-6">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id as any)}
              className={classNames(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                activeSection === section.id
                  ? 'bg-rial-navy text-rial-cream ring-1 ring-rial-gold/30'
                  : 'bg-gray-100 text-gray-700 hover:bg-rial-cream-dark/40 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-slate-600'
              )}
            >
              {section.label} ({section.count})
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div className="space-y-4">
          {activeSection === 'all' && activities.map((activity, index) => {
            const Icon = activity.icon
            return (
              <motion.div
                key={`activity-${index}-${activity.id || 'unknown'}`}
                className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-rial-cream-dark/50 dark:bg-slate-800">
                  <Icon className="h-6 w-6 text-rial-navy dark:text-rial-gold" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{activity.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{activity.description}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {activity.date.toLocaleDateString()}
                  </p>
                </div>
              </motion.div>
            )
          })}

          {activeSection === 'favorites' && favorites.map((favorite, index) => (
            <motion.div
              key={`favorite-activity-${index}-${favorite.id || favorite.property?.id || 'unknown'}`}
              className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <img 
                src={favorite.property.images[0]} 
                alt={favorite.property.title}
                className="w-12 h-12 rounded-lg object-cover"
              />
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">{favorite.property.title}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">${favorite.property.price}/mes</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Agregado el {favorite.addedAt.toLocaleDateString()}
                </p>
              </div>
            </motion.div>
          ))}

          {activeSection === 'bookings' && bookings.map((booking, index) => (
            <motion.div
              key={`booking-${index}-${booking.id || 'unknown'}`}
              className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">{booking.property.title}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {booking.startDate.toLocaleDateString()} - {booking.endDate.toLocaleDateString()}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Estado: {booking.status === 'confirmed' ? 'Confirmada' : 'Pendiente'}
                </p>
              </div>
            </motion.div>
          ))}

          {activeSection === 'reviews' && reviews.map((review, index) => (
            <motion.div
              key={`review-${index}-${review.id || 'unknown'}`}
              className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center">
                <Star className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">{review.property.title}</p>
                <div className="flex items-center gap-1 mb-1">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      className={`w-4 h-4 ${i < review.rating ? 'text-yellow-500 fill-current' : 'text-gray-300'}`} 
                    />
                  ))}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{review.comment}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {review.date.toLocaleDateString()}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </>
  )
}

// Componente ConfiguraciÃ³n
function SettingsTab({ user, onUpdate }: { user: UserProfileData, onUpdate: (data: Partial<UserProfileData>) => void }) {
  const { t } = useTranslation()
  const [settings, setSettings] = useState(user.preferences)

  const updateSetting = (key: string, value: any) => {
    const newSettings = { ...settings }
    const keys = key.split('.')
    let current: any = newSettings
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]]
    }
    current[keys[keys.length - 1]] = value
    setSettings(newSettings)
    onUpdate({ preferences: newSettings })
    if (key === 'language') setAppLanguage(value)
  }

  return (
    <>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('profile.settings')}</h2>
      
      <div className="space-y-8">
        {/* Notificaciones */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notificaciones</h3>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.notifications.email}
                onChange={(e) => updateSetting('notifications.email', e.target.checked)}
                className="h-4 w-4 rounded text-rial-navy focus:ring-rial-gold dark:text-rial-gold"
              />
              <span className="text-gray-700 dark:text-gray-300">Notificaciones por email</span>
            </label>
            
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.notifications.push}
                onChange={(e) => updateSetting('notifications.push', e.target.checked)}
                className="h-4 w-4 rounded text-rial-navy focus:ring-rial-gold dark:text-rial-gold"
              />
              <span className="text-gray-700 dark:text-gray-300">Notificaciones push</span>
            </label>
            
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.notifications.sms}
                onChange={(e) => updateSetting('notifications.sms', e.target.checked)}
                className="h-4 w-4 rounded text-rial-navy focus:ring-rial-gold dark:text-rial-gold"
              />
              <span className="text-gray-700 dark:text-gray-300">Notificaciones por SMS</span>
            </label>
          </div>
        </div>

        {/* Privacidad */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Privacidad</h3>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.privacy.profileVisible}
                onChange={(e) => updateSetting('privacy.profileVisible', e.target.checked)}
                className="h-4 w-4 rounded text-rial-navy focus:ring-rial-gold dark:text-rial-gold"
              />
              <span className="text-gray-700 dark:text-gray-300">{t('profile.publicProfile')}</span>
            </label>
            
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.privacy.showEmail}
                onChange={(e) => updateSetting('privacy.showEmail', e.target.checked)}
                className="h-4 w-4 rounded text-rial-navy focus:ring-rial-gold dark:text-rial-gold"
              />
              <span className="text-gray-700 dark:text-gray-300">Mostrar email en perfil</span>
            </label>
            
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.privacy.showPhone}
                onChange={(e) => updateSetting('privacy.showPhone', e.target.checked)}
                className="h-4 w-4 rounded text-rial-navy focus:ring-rial-gold dark:text-rial-gold"
              />
              <span className="text-gray-700 dark:text-gray-300">Mostrar telÃ©fono en perfil</span>
            </label>
          </div>
        </div>

        {/* Apariencia */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Apariencia</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('profile.theme')}
              </label>
              <select
                value={settings.theme}
                onChange={(e) => updateSetting('theme', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="light">{t('profile.light')}</option>
                <option value="dark">{t('profile.dark')}</option>
                <option value="auto">{t('profile.auto')}</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('profile.language')}
              </label>
              <select
                value={settings.language}
                onChange={(e) => updateSetting('language', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="es">{t('profile.spanish')}</option>
                <option value="en">{t('profile.english')}</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// Componente Seguridad
function SecurityTab({ user, onUpdate, token }: { user: UserProfileData, onUpdate: (data: Partial<UserProfileData>) => void, token: string }) {
  const { t } = useTranslation()
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: ''
  })

  const handlePasswordChange = async () => {
    // Implementar cambio de contraseÃ±a
    console.log('Changing password...')
    setShowPasswordForm(false)
    setPasswordData({ current: '', new: '', confirm: '' })
  }

  return (
    <>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('profile.security')}</h2>
      
      <div className="space-y-6">
        {/* VerificaciÃ³n de identidad */}
        <VerificationSystem
          token={token}
          user={user}
          onUpdate={() => {
            onUpdate({ verified: true })
          }}
        />

        {/* Cambio de contraseÃ±a */}
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                ContraseÃ±a
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Cambia tu contraseÃ±a regularmente para mantener tu cuenta segura
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPasswordForm(!showPasswordForm)}
            >
              Cambiar contraseÃ±a
            </Button>
          </div>

          {showPasswordForm && (
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Input
                type="password"
                placeholder="ContraseÃ±a actual"
                value={passwordData.current}
                onChange={(value) => setPasswordData({ ...passwordData, current: value })}
              />
              <Input
                type="password"
                placeholder="Nueva contraseÃ±a"
                value={passwordData.new}
                onChange={(value) => setPasswordData({ ...passwordData, new: value })}
              />
              <Input
                type="password"
                placeholder="Confirmar nueva contraseÃ±a"
                value={passwordData.confirm}
                onChange={(value) => setPasswordData({ ...passwordData, confirm: value })}
              />
              <div className="flex gap-2">
                <Button onClick={handlePasswordChange}>
                  Cambiar contraseÃ±a
                </Button>
                <Button variant="outline" onClick={() => setShowPasswordForm(false)}>
                  Cancelar
                </Button>
              </div>
            </motion.div>
          )}
        </div>

        {/* VerificaciÃ³n de email */}
        <EmailVerification 
          token={token} 
          user={user} 
          onUpdate={() => onUpdate({ emailVerified: true })}
        />

        {/* AutenticaciÃ³n de dos factores */}
        <TwoFactorAuth 
          token={token} 
          user={user} 
          onUpdate={() => {}}
        />

        {/* Sesiones activas */}
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            Sesiones activas
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Chrome - Windows</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">192.168.1.100 â€¢ Hace 2 horas</p>
              </div>
              <Button size="sm" variant="outline" className="text-red-600">
                {t('profile.logout')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
