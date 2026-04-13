import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, Star, MapPin, DollarSign, Bell, X, Trash2, Eye, Share2 } from 'lucide-react'
import { Button, LoadingSpinner, classNames } from './UI'

interface FavoriteProperty {
  id: number
  property: {
    id: number
    title: string
    price: number
    location: string
    images: string[]
    averageRating: number
    reviewsCount: number
  }
  addedAt: string
  priceAlert: boolean
  originalPrice: number
  currentPrice: number
}

interface FavoritesSystemProps {
  token: string
  user: any
  onPropertyClick: (id: number) => void
  properties?: any[] // Propiedades disponibles para construir favoritos completos
}

const FAVORITES_API_ENABLED = false

export function FavoritesSystem({ token, user, onPropertyClick, properties = [] }: FavoritesSystemProps) {
  const [favorites, setFavorites] = useState<FavoriteProperty[]>([])
  const [loading, setLoading] = useState(true)
  const [showFavorites, setShowFavorites] = useState(false)
  const [priceAlerts, setPriceAlerts] = useState<any[]>([])

  useEffect(() => {
    loadFavoritesFromStorage()
    const handleFavoritesUpdate = (e: CustomEvent) => {
      buildFavoritesFromIds(e.detail)
    }
    window.addEventListener('favoritesUpdated', handleFavoritesUpdate as EventListener)
    return () => {
      window.removeEventListener('favoritesUpdated', handleFavoritesUpdate as EventListener)
    }
  }, [])

  useEffect(() => {
    if (token && FAVORITES_API_ENABLED) {
      loadFavoritesFromAPI().catch(() => {})
      loadPriceAlerts().catch(() => setPriceAlerts([]))
    } else {
      setLoading(false)
    }
  }, [token])

  function buildFavoritesFromIds(favoriteIds: number[]) {
    if (!properties || properties.length === 0) {
      setFavorites([])
      setLoading(false)
      return
    }

    const favoriteProperties: FavoriteProperty[] = favoriteIds
      .map(id => {
        // Buscar la propiedad en la lista de propiedades disponibles
        const propertyItem = properties.find((item: any) => 
          item.property?.id === id || item.id === id
        )
        
        if (!propertyItem) return null

        const prop = propertyItem.property || propertyItem
        return {
          id: Date.now() + id, // ID único para el favorito
          property: {
            id: prop.id,
            title: prop.title || 'Sin título',
            price: prop.price || 0,
            location: prop.location || 'Ubicación no disponible',
            images: prop.images || [],
            averageRating: propertyItem.averageRating || 0,
            reviewsCount: propertyItem.reviewsCount || 0
          },
          addedAt: new Date().toISOString(),
          priceAlert: false,
          originalPrice: prop.price || 0,
          currentPrice: prop.price || 0
        }
      })
      .filter((f): f is FavoriteProperty => f !== null)

    setFavorites(favoriteProperties)
    setLoading(false)
  }

  function loadFavoritesFromStorage() {
    try {
      const stored = localStorage.getItem('rial_favorites')
      const favoriteIds: number[] = stored ? JSON.parse(stored) : []
      buildFavoritesFromIds(favoriteIds)
    } catch (error) {
      console.error('Error loading favorites from storage:', error)
      setFavorites([])
      setLoading(false)
    }
  }

  async function loadFavoritesFromAPI() {
    try {
      const res = await fetch('/api/favorites', {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => null)
      
      if (res && res.ok) {
        const data = await res.json().catch(() => [])
        if (Array.isArray(data) && data.length > 0) {
          setFavorites(data)
          setLoading(false)
          return
        }
      }
      
      // Si no hay datos de API, usar localStorage
      loadFavoritesFromStorage()
    } catch (error) {
      // Si falla, usar localStorage
      loadFavoritesFromStorage()
    }
  }

  async function loadPriceAlerts() {
    try {
      const res = await fetch('/api/favorites/price-alerts', {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => null)
      
      if (!res || !res.ok) {
        // Si el endpoint no existe (404) o hay error, usar array vacío silenciosamente
        setPriceAlerts([])
        return
      }
      
      const data = await res.json().catch(() => [])
      setPriceAlerts(Array.isArray(data) ? data : [])
    } catch (error) {
      // Silenciar todos los errores de endpoints no implementados
      setPriceAlerts([])
    }
  }

  async function toggleFavorite(propertyId: number) {
    try {
      const isFavorite = favorites.some(f => f.property.id === propertyId)
      
      if (isFavorite) {
        if (FAVORITES_API_ENABLED) {
          await fetch(`/api/favorites/${propertyId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          })
        }
        setFavorites(prev => prev.filter(f => f.property.id !== propertyId))
      } else {
        if (FAVORITES_API_ENABLED) {
          const response = await fetch('/api/favorites', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}` 
            },
            body: JSON.stringify({ propertyId })
          })
          const newFavorite = await response.json()
          setFavorites(prev => [...prev, newFavorite])
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
    }
  }

  async function togglePriceAlert(propertyId: number) {
    try {
      if (FAVORITES_API_ENABLED) {
        await fetch(`/api/favorites/${propertyId}/price-alert`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` }
        })
      }
      setFavorites(prev => prev.map(f => 
        f.property.id === propertyId 
          ? { ...f, priceAlert: !f.priceAlert }
          : f
      ))
    } catch (error) {
      console.error('Error toggling price alert:', error)
    }
  }

  async function removeFavorite(propertyId: number) {
    try {
      // Intentar eliminar de API
      if (FAVORITES_API_ENABLED) {
        await fetch(`/api/favorites/${propertyId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {}) // Ignorar errores de API
      }
      
      // Actualizar estado local
      setFavorites(prev => prev.filter(f => f.property.id !== propertyId))
      
      // Actualizar localStorage
      try {
        const stored = localStorage.getItem('rial_favorites')
        const favoriteIds: number[] = stored ? JSON.parse(stored) : []
        const updatedIds = favoriteIds.filter(id => id !== propertyId)
        localStorage.setItem('rial_favorites', JSON.stringify(updatedIds))
        window.dispatchEvent(new CustomEvent('favoritesUpdated', { detail: updatedIds }))
      } catch (error) {
        console.error('Error updating localStorage:', error)
      }
    } catch (error) {
      console.error('Error removing favorite:', error)
    }
  }

  const priceChange = (favorite: FavoriteProperty) => {
    const change = favorite.currentPrice - favorite.originalPrice
    const percentage = (change / favorite.originalPrice) * 100
    return { change, percentage }
  }

  return (
    <>
      {/* Botón de favoritos en header */}
      <motion.button
        onClick={() => setShowFavorites(true)}
        className="relative p-2 rounded-xl bg-white/70 dark:bg-gray-800/70 hover:bg-white/90 dark:hover:bg-gray-700/90 transition-all duration-200 shadow-lg backdrop-blur-sm"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Heart className="w-5 h-5 text-red-500 fill-current" />
        {favorites.length > 0 && (
          <motion.span 
            className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            {favorites.length}
          </motion.span>
        )}
      </motion.button>

      {/* Panel de favoritos */}
      <AnimatePresence>
        {showFavorites && (
          <motion.div 
            className="fixed inset-0 bg-black/40 backdrop-blur flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowFavorites(false)}
          >
            <motion.div 
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-4xl max-h-[80vh] overflow-hidden"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Mis Favoritos</h2>
                  <p className="text-gray-600 dark:text-gray-400">{favorites.length} propiedades guardadas</p>
                </div>
                <Button variant="outline" onClick={() => setShowFavorites(false)} icon={<X className="w-4 h-4" />}>
                  Cerrar
                </Button>
              </div>

              {/* Alertas de precio */}
              {priceAlerts.length > 0 && (
                <motion.div 
                  className="mb-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900 dark:to-blue-900 rounded-xl border border-green-200 dark:border-green-700"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Bell className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <h3 className="font-semibold text-green-800 dark:text-green-200">Alertas de Precio</h3>
                  </div>
                  <div className="space-y-2">
                    {priceAlerts.map((alert) => (
                      <div key={alert.id} className="flex items-center justify-between p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                        <div>
                          <div className="font-medium text-green-800 dark:text-green-200">{alert.property.title}</div>
                          <div className="text-sm text-green-600 dark:text-green-300">
                            Precio bajó de ${alert.originalPrice} a ${alert.currentPrice}
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => onPropertyClick(alert.property.id)}>
                          Ver
                        </Button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Lista de favoritos */}
              <div className="overflow-y-auto max-h-[60vh]">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner size="lg" text="Cargando favoritos..." />
                  </div>
                ) : favorites.length === 0 ? (
                  <motion.div 
                    className="text-center py-12"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Heart className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No tienes favoritos</h3>
                    <p className="text-gray-600 dark:text-gray-400">Guarda propiedades que te interesen para verlas aquí</p>
                  </motion.div>
                ) : (
                  <div className="grid gap-4">
                    {favorites.map((favorite, index) => {
                      const { change, percentage } = priceChange(favorite)
                      const img = favorite.property.images?.[0]
                      
                      return (
                        <motion.div 
                          key={favorite.property.id}
                          className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          {/* Imagen */}
                          <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-600 flex-shrink-0">
                            {img ? (
                              <img 
                                src={img} 
                                alt={favorite.property.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <Eye className="w-8 h-8" />
                              </div>
                            )}
                          </div>

                          {/* Información */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                                {favorite.property.title}
                              </h3>
                              <div className="flex items-center gap-2">
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => togglePriceAlert(favorite.property.id)}
                                  className={favorite.priceAlert ? 'text-red-500' : 'text-gray-400'}
                                >
                                  <Bell className="w-4 h-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => removeFavorite(favorite.property.id)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            
                            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-2">
                              <MapPin className="w-4 h-4 mr-1" />
                              {favorite.property.location}
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="flex items-center">
                                  <Star className="w-4 h-4 text-yellow-500 fill-current mr-1" />
                                  <span className="text-sm font-medium">{favorite.property.averageRating.toFixed(1)}</span>
                                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                                    ({favorite.property.reviewsCount})
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <DollarSign className="w-4 h-4 text-gray-400" />
                                  <span className="font-bold text-lg text-gray-900 dark:text-white">
                                    ${favorite.currentPrice}
                                  </span>
                                  {change !== 0 && (
                                    <span className={classNames(
                                      'text-sm font-medium px-2 py-1 rounded-full',
                                      change < 0 
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                        : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                                    )}>
                                      {change > 0 ? '+' : ''}{percentage.toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                              </div>

                              <Button 
                                size="sm" 
                                onClick={() => onPropertyClick(favorite.property.id)}
                                icon={<Eye className="w-4 h-4" />}
                              >
                                Ver
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// Utilidad para manejar localStorage de favoritos
const FAVORITES_STORAGE_KEY = 'rial_favorites'

function getFavoritesFromStorage(): number[] {
  try {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveFavoritesToStorage(favorites: number[]) {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites))
    // Disparar evento personalizado para sincronizar entre componentes
    window.dispatchEvent(new CustomEvent('favoritesUpdated', { detail: favorites }))
  } catch (error) {
    console.error('Error saving favorites to storage:', error)
  }
}

// Hook para usar favoritos en otros componentes
export function useFavorites(token?: string) {
  const [favorites, setFavorites] = useState<number[]>(() => getFavoritesFromStorage())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Cargar desde localStorage primero
    const stored = getFavoritesFromStorage()
    setFavorites(stored)
    setLoading(false)

    // Intentar sincronizar con API si hay token
    if (token && FAVORITES_API_ENABLED) {
      loadFavoritesFromAPI().catch(() => {
        // Si falla, mantener los de localStorage
      })
    }

    // Escuchar cambios en favoritos desde otros componentes
    const handleFavoritesUpdate = (e: CustomEvent) => {
      setFavorites(e.detail)
    }
    window.addEventListener('favoritesUpdated', handleFavoritesUpdate as EventListener)

    return () => {
      window.removeEventListener('favoritesUpdated', handleFavoritesUpdate as EventListener)
    }
  }, [token])

  async function loadFavoritesFromAPI() {
    try {
      const res = await fetch('/api/favorites', {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => null)
      
      if (res && res.ok) {
        const data = await res.json().catch(() => [])
        const apiFavorites = Array.isArray(data) 
          ? data.map((f: any) => f.property?.id || f.propertyId || f).filter(Boolean) 
          : []
        // Combinar con localStorage (prioridad a API si existe)
        const combined = [...new Set([...apiFavorites, ...getFavoritesFromStorage()])]
        setFavorites(combined)
        saveFavoritesToStorage(combined)
      }
    } catch (error) {
      // Silenciar errores de endpoints no implementados
    }
  }

  async function toggleFavorite(propertyId: number) {
    const isFavorite = favorites.includes(propertyId)
    let newFavorites: number[]

    if (isFavorite) {
      newFavorites = favorites.filter(id => id !== propertyId)
      // Intentar eliminar de API
      if (FAVORITES_API_ENABLED) {
        try {
          await fetch(`/api/favorites/${propertyId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => {})
        } catch (error) {
          // Ignorar errores de API
        }
      }
    } else {
      newFavorites = [...favorites, propertyId]
      // Intentar agregar a API
      if (FAVORITES_API_ENABLED) {
        try {
          await fetch('/api/favorites', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}` 
            },
            body: JSON.stringify({ propertyId })
          }).catch(() => {})
        } catch (error) {
          // Ignorar errores de API
        }
      }
    }

    // Actualizar estado y localStorage
    setFavorites(newFavorites)
    saveFavoritesToStorage(newFavorites)
  }

  return { favorites, loading, toggleFavorite }
}
