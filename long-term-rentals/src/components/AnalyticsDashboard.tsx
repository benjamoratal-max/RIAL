import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, Eye, MessageSquare, Home, DollarSign, Users, Calendar, Clock } from 'lucide-react'
import { Button, LoadingSpinner, classNames } from './UI'
import { toast } from 'react-hot-toast'

interface AnalyticsDashboardProps {
  token: string
  user: any
  onClose: () => void
}

export function AnalyticsDashboard({ token, user, onClose }: AnalyticsDashboardProps) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedProperty, setSelectedProperty] = useState<number | null>(null)
  const [propertyData, setPropertyData] = useState<any>(null)

  useEffect(() => {
    if (token && (user?.role === 'owner' || user?.role === 'admin' || user?.role === 'broker' || user?.role === 'broker_admin')) {
      loadDashboard()
    }
  }, [token, user])

  async function loadDashboard() {
    try {
      const endpoint =
        user?.role === 'broker' || user?.role === 'broker_admin'
          ? '/api/analytics/broker/dashboard'
          : '/api/analytics/owner/dashboard'
      const res = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al cargar analytics')
      }
      const dashboardData = await res.json()
      setData(dashboardData)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadPropertyAnalytics(propertyId: number) {
    try {
      const res = await fetch(`/api/analytics/property/${propertyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (!res.ok) throw new Error('Error al cargar estadísticas')
      const propData = await res.json()
      setPropertyData(propData)
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  if (!user || (user.role !== 'owner' && user.role !== 'admin' && user.role !== 'broker' && user.role !== 'broker_admin')) {
    return null
  }

  if (loading) {
    return (
      <motion.div
        className="fixed inset-0 bg-black/40 backdrop-blur flex items-center justify-center p-4 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white dark:bg-gray-800 rounded-2xl p-6"
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.9 }}
          onClick={(e) => e.stopPropagation()}
        >
          <LoadingSpinner size="lg" text="Cargando analytics..." />
        </motion.div>
      </motion.div>
    )
  }

  if (!data || !data.overview) {
    return (
      <motion.div
        className="fixed inset-0 bg-black/40 backdrop-blur flex items-center justify-center p-4 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white dark:bg-gray-800 rounded-2xl p-6"
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.9 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center text-gray-500 dark:text-gray-400">
            No hay datos disponibles
          </div>
        </motion.div>
      </motion.div>
    )
  }

  const isBrokerMode = user.role === 'broker' || user.role === 'broker_admin'
  const { overview, viewsByProperty = [], reviewsByProperty = [], interestByProperty = [] } = data

  return (
    <motion.div
      className="fixed inset-0 bg-black/40 backdrop-blur flex items-center justify-center p-4 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isBrokerMode ? 'Broker / Team Analytics' : 'Dashboard de Analytics'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {isBrokerMode
                ? 'Métricas de leads, pipeline y performance para brokers.'
                : 'Estadísticas y métricas de tus propiedades'}
            </p>
          </div>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Overview Cards */}
          {isBrokerMode ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <motion.div
                className="rounded-xl border border-rial-cream-dark/40 bg-rial-cream-dark/35 p-4 dark:border-slate-600 dark:bg-slate-800/70"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <Users className="h-5 w-5 text-rial-navy dark:text-rial-gold" />
                  <span className="text-2xl font-bold font-serif text-rial-navy dark:text-rial-cream">
                    {overview.totalLeads}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Leads totales</div>
              </motion.div>
              <motion.div
                className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {overview.averageResponseHours.toFixed(1)}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Horas respuesta promedio</div>
              </motion.div>
              <motion.div
                className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <Calendar className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {overview.showingsScheduled}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Showings agendados</div>
              </motion.div>
              <motion.div
                className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {overview.pipelineConversion.toFixed(1)}%
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Lead → Signed conversion</div>
              </motion.div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <motion.div
                className="rounded-xl border border-rial-cream-dark/40 bg-rial-cream-dark/35 p-4 dark:border-slate-600 dark:bg-slate-800/70"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <Home className="h-5 w-5 text-rial-navy dark:text-rial-gold" />
                  <span className="text-2xl font-bold font-serif text-rial-navy dark:text-rial-cream">
                    {overview.totalProperties}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Propiedades</div>
              </motion.div>
              <motion.div
                className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <Eye className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {overview.totalViews}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Vistas</div>
              </motion.div>
              <motion.div
                className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <MessageSquare className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                  <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {overview.averageRating.toFixed(1)}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Rating Promedio</div>
              </motion.div>
              <motion.div
                className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {overview.conversionRate.toFixed(1)}%
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Tasa de Conversión</div>
              </motion.div>
            </div>
          )}

          {/* Vistas por Propiedad */}
          <div className="mb-6">
            <h3 className="font-semibold text-lg mb-4 text-gray-900 dark:text-white">Vistas por Propiedad</h3>
            <div className="space-y-2">
              {viewsByProperty.map((vp: any) => (
                <motion.div
                  key={vp.propertyId}
                  className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{vp.propertyTitle}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {vp.views} vistas · {vp.uniqueViews} únicas
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedProperty(vp.propertyId)
                        loadPropertyAnalytics(vp.propertyId)
                      }}
                    >
                      Ver Detalles
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Reviews por Propiedad */}
          <div className="mb-6">
            <h3 className="font-semibold text-lg mb-4 text-gray-900 dark:text-white">Reviews por Propiedad</h3>
            <div className="space-y-2">
              {reviewsByProperty.map((rp: any) => (
                <motion.div
                  key={rp.propertyId}
                  className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{rp.propertyTitle}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {rp.reviewsCount} reviews · ⭐ {rp.averageRating.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Interés por Propiedad */}
          <div>
            <h3 className="font-semibold text-lg mb-4 text-gray-900 dark:text-white">Interés por Propiedad</h3>
            <div className="space-y-2">
              {interestByProperty.map((ip: any) => (
                <motion.div
                  key={ip.propertyId}
                  className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{ip.propertyTitle}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {ip.leaseRequests} solicitudes · {ip.approvedLeases} aprobadas · {ip.pendingLeases} pendientes
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

