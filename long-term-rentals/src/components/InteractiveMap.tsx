import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  MapPin, 
  Search, 
  Navigation, 
  Star, 
  DollarSign, 
  Home, 
  X, 
  Filter,
  Layers,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Info,
  Phone,
  Globe,
  Clock
} from 'lucide-react'
import { Button, Input, classNames } from './UI'

interface Property {
  id: number
  title: string
  price: number
  location: string
  latitude: number
  longitude: number
  averageRating: number
  reviewsCount: number
  images: string[]
  isAvailable: boolean
}

interface MapPoint {
  id: number
  type: 'property' | 'poi'
  title: string
  description: string
  latitude: number
  longitude: number
  price?: number
  rating?: number
  category?: string
  distance?: number
}

interface InteractiveMapProps {
  properties: Property[]
  onPropertyClick: (property: Property) => void
  onLocationSelect: (lat: number, lng: number) => void
  center?: { lat: number; lng: number }
  zoom?: number
  searchRadius?: number
}

// Mock de Google Maps API (en producción usarías la API real)
declare global {
  interface Window {
    google: any
    initMap: () => void
  }
}

export function InteractiveMap({ 
  properties, 
  onPropertyClick, 
  onLocationSelect,
  center = { lat: 40.7128, lng: -74.0060 }, // NYC por defecto
  zoom = 12,
  searchRadius = 5000
}: InteractiveMapProps) {
  const [map, setMap] = useState<any>(null)
  const [markers, setMarkers] = useState<any[]>([])
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid' | 'terrain'>('roadmap')
  const [pointsOfInterest, setPointsOfInterest] = useState<MapPoint[]>([])
  const [showPOI, setShowPOI] = useState(true)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  const mapRef = useRef<HTMLDivElement>(null)
  const searchBoxRef = useRef<HTMLDivElement>(null)

  // Inicializar mapa
  useEffect(() => {
    if (!mapRef.current) return

    // Simular carga de Google Maps
    setTimeout(() => {
      const mockMap = {
        setCenter: (latLng: any) => console.log('Map center set to:', latLng),
        setZoom: (zoom: number) => console.log('Map zoom set to:', zoom),
        addListener: (event: string, callback: () => void) => {
          console.log('Listener added:', event)
          callback()
        },
        getBounds: () => ({ getNorthEast: () => ({ lat: () => 40.8, lng: () => -73.9 }), getSouthWest: () => ({ lat: () => 40.6, lng: () => -74.1 }) }),
        fitBounds: (bounds: any) => console.log('Bounds fitted:', bounds)
      }
      
      setMap(mockMap)
      setIsLoading(false)
      initializeMarkers()
    }, 1000)
  }, [])

  // Inicializar marcadores
  const initializeMarkers = (source = properties) => {
    if (!source || !source.length) {
      setMarkers([])
      return
    }
    const mockMarkers = source.map(property => ({
      id: property.id,
      position: { lat: property.latitude, lng: property.longitude },
      property,
      setMap: (map: any) => console.log('Marker added to map'),
      addListener: (event: string, callback: () => void) => {
        console.log('Marker listener added:', event)
        callback()
      }
    }))
    
    setMarkers(mockMarkers)
    if (map && mockMarkers[0]) {
      map.setCenter(mockMarkers[0].position)
    }
    
    // Agregar listeners a los marcadores
    mockMarkers.forEach(marker => {
      marker.addListener('click', () => handleMarkerClick(marker.property))
    })
  }

  useEffect(() => {
    if (!properties || properties.length === 0) {
      setMarkers([])
      return
    }
    initializeMarkers(properties)
  }, [properties])

  // Obtener ubicación del usuario
  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setUserLocation({ lat: latitude, lng: longitude })
          
          if (map) {
            map.setCenter({ lat: latitude, lng: longitude })
            map.setZoom(15)
          }
        },
        (error) => {
          console.error('Error getting location:', error)
        }
      )
    }
  }

  // Buscar ubicación
  const searchLocation = async () => {
    if (!searchQuery.trim()) return

    try {
      // Simular búsqueda de geocoding
      const mockResults = [
        { lat: 40.7128, lng: -74.0060, formatted_address: 'New York, NY, USA' },
        { lat: 40.7589, lng: -73.9851, formatted_address: 'Times Square, New York, NY, USA' }
      ]
      
      if (mockResults.length > 0) {
        const result = mockResults[0]
        const latLng = { lat: result.lat, lng: result.lng }
        
        if (map) {
          map.setCenter(latLng)
          map.setZoom(15)
        }
        
        onLocationSelect(result.lat, result.lng)
      }
    } catch (error) {
      console.error('Error searching location:', error)
    }
  }

  // Manejar clic en marcador
  const handleMarkerClick = (property: Property) => {
    setSelectedProperty(property)
  }

  // Cargar puntos de interés
  const loadPointsOfInterest = async () => {
    if (!map) return

    try {
      // Simular carga de POI
      const mockPOI = [
        {
          id: 1,
          type: 'poi' as const,
          title: 'Estación de Metro',
          description: 'Estación de metro más cercana',
          latitude: center.lat + 0.001,
          longitude: center.lng + 0.001,
          category: 'transport',
          distance: 200
        },
        {
          id: 2,
          type: 'poi' as const,
          title: 'Supermercado',
          description: 'Supermercado 24/7',
          latitude: center.lat - 0.001,
          longitude: center.lng - 0.001,
          category: 'shopping',
          distance: 500
        },
        {
          id: 3,
          type: 'poi' as const,
          title: 'Parque',
          description: 'Parque público con áreas recreativas',
          latitude: center.lat + 0.002,
          longitude: center.lng - 0.002,
          category: 'recreation',
          distance: 800
        }
      ]
      
      setPointsOfInterest(mockPOI)
    } catch (error) {
      console.error('Error loading POI:', error)
    }
  }

  // Cambiar tipo de mapa
  const changeMapType = (type: 'roadmap' | 'satellite' | 'hybrid' | 'terrain') => {
    setMapType(type)
    // En implementación real: map.setMapTypeId(type)
  }

  // Zoom in/out
  const zoomMap = (direction: 'in' | 'out') => {
    if (map) {
      const currentZoom = zoom
      const newZoom = direction === 'in' ? currentZoom + 1 : currentZoom - 1
      map.setZoom(Math.max(8, Math.min(20, newZoom)))
    }
  }

  // Filtrar propiedades por precio
  const filterPropertiesByPrice = (minPrice: number, maxPrice: number) => {
    const filtered = properties.filter(property => 
      property.price >= minPrice && property.price <= maxPrice
    )
    // Actualizar marcadores en el mapa
    console.log('Filtered properties:', filtered.length)
  }

  // Filtrar propiedades por rating
  const filterPropertiesByRating = (minRating: number) => {
    const filtered = properties.filter(property => 
      property.averageRating >= minRating
    )
    console.log('Filtered properties by rating:', filtered.length)
  }

  return (
    <div className="relative w-full h-full">
      {/* Controles superiores */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center gap-2">
        <div className="flex-1">
          <Input
            placeholder="Buscar ubicación..."
            value={searchQuery}
            onChange={setSearchQuery}
            icon={<Search className="w-4 h-4" />}
            onKeyPress={(e) => e.key === 'Enter' && searchLocation()}
          />
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={getUserLocation}
          icon={<Crosshair className="w-4 h-4" />}
          className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm"
        />
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          icon={<Filter className="w-4 h-4" />}
          className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm"
        />
      </div>

      {/* Controles de zoom */}
      <div className="absolute right-4 top-20 z-10 flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => zoomMap('in')}
          icon={<ZoomIn className="w-4 h-4" />}
          className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => zoomMap('out')}
          icon={<ZoomOut className="w-4 h-4" />}
          className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm"
        />
      </div>

      {/* Controles de tipo de mapa */}
      <div className="absolute left-4 bottom-4 z-10">
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-2">
          <div className="flex flex-col gap-1">
            {(['roadmap', 'satellite', 'hybrid', 'terrain'] as const).map((type) => (
              <button
                key={type}
                onClick={() => changeMapType(type)}
                className={classNames(
                  'px-3 py-1 text-xs rounded-lg transition-all duration-200',
                  mapType === type
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            className="absolute top-20 left-4 z-10 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-gray-200 dark:border-gray-700"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Filtros</h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">Rango de precio</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Mín"
                    value=""
                    onChange={() => {}}
                    className="w-20"
                  />
                  <Input
                    type="number"
                    placeholder="Máx"
                    value=""
                    onChange={() => {}}
                    className="w-20"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">Rating mínimo</label>
                <select className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                  <option value="">Cualquier rating</option>
                  <option value="4.5">4.5+ estrellas</option>
                  <option value="4.0">4.0+ estrellas</option>
                  <option value="3.5">3.5+ estrellas</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showPOI"
                  checked={showPOI}
                  onChange={(e) => setShowPOI(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="showPOI" className="text-sm text-gray-700 dark:text-gray-300">
                  Mostrar puntos de interés
                </label>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mapa */}
      <div ref={mapRef} className="w-full h-full bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-500 rounded-full animate-pulse"></div>
              <p className="text-gray-600 dark:text-gray-400">Cargando mapa...</p>
            </div>
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-50 to-green-50 dark:from-gray-700 dark:to-gray-800 relative">
            {/* Marcadores simulados */}
            {properties.map((property) => (
              <div
                key={property.id}
                className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-full"
                style={{
                  left: `${50 + (property.longitude - center.lng) * 1000}%`,
                  top: `${50 - (property.latitude - center.lat) * 1000}%`
                }}
                onClick={() => handleMarkerClick(property)}
              >
                <div className="relative">
                  <div className="w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                    <Home className="w-3 h-3 text-white" />
                  </div>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 bg-white dark:bg-gray-800 px-2 py-1 rounded text-xs shadow-lg whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity">
                    ${property.price}/mes
                  </div>
                </div>
              </div>
            ))}
            
            {/* Puntos de interés */}
            {showPOI && pointsOfInterest.map((poi) => (
              <div
                key={poi.id}
                className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-full"
                style={{
                  left: `${50 + (poi.longitude - center.lng) * 1000}%`,
                  top: `${50 - (poi.latitude - center.lat) * 1000}%`
                }}
              >
                <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Panel de propiedad seleccionada */}
      <AnimatePresence>
        {selectedProperty && (
          <motion.div
            className="absolute bottom-4 left-4 right-4 z-10 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-gray-200 dark:border-gray-700"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  {selectedProperty.title}
                </h3>
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    {selectedProperty.location}
                  </div>
                  <div className="flex items-center">
                    <Star className="w-4 h-4 mr-1 text-yellow-500" />
                    {selectedProperty.averageRating.toFixed(1)} ({selectedProperty.reviewsCount})
                  </div>
                  <div className="flex items-center font-semibold text-green-600">
                    <DollarSign className="w-4 h-4 mr-1" />
                    {selectedProperty.price}/mes
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => onPropertyClick(selectedProperty)}
                  icon={<Info className="w-4 h-4" />}
                >
                  Ver detalles
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedProperty(null)}
                  icon={<X className="w-4 h-4" />}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Información de puntos de interés */}
      {showPOI && pointsOfInterest.length > 0 && (
        <div className="absolute top-20 right-4 z-10 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl p-3 shadow-lg border border-gray-200 dark:border-gray-700 max-w-xs">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Puntos de interés</h4>
          <div className="space-y-2">
            {pointsOfInterest.map((poi) => (
              <div key={poi.id} className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{poi.title}</div>
                  <div className="text-gray-600 dark:text-gray-400">{poi.distance}m</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Componente de búsqueda avanzada
export function AdvancedMapSearch({ onSearch }: { onSearch: (query: string, filters: any) => void }) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({
    radius: 5000,
    propertyType: '',
    minPrice: '',
    maxPrice: '',
    bedrooms: '',
    bathrooms: ''
  })

  return (
    <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-gray-200 dark:border-gray-700">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Búsqueda avanzada</h3>
      
      <div className="space-y-3">
        <Input
          placeholder="Ubicación o dirección..."
          value={query}
          onChange={setQuery}
          icon={<Search className="w-4 h-4" />}
        />
        
        <div>
          <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">Radio de búsqueda</label>
          <select
            value={filters.radius}
            onChange={(e) => setFilters({ ...filters, radius: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          >
            <option value={1000}>1 km</option>
            <option value={5000}>5 km</option>
            <option value={10000}>10 km</option>
            <option value={25000}>25 km</option>
          </select>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            placeholder="Precio mín"
            value={filters.minPrice}
            onChange={(value) => setFilters({ ...filters, minPrice: value })}
            icon={<DollarSign className="w-4 h-4" />}
          />
          <Input
            type="number"
            placeholder="Precio máx"
            value={filters.maxPrice}
            onChange={(value) => setFilters({ ...filters, maxPrice: value })}
            icon={<DollarSign className="w-4 h-4" />}
          />
        </div>
        
        <Button
          onClick={() => onSearch(query, filters)}
          icon={<Search className="w-4 h-4" />}
          className="w-full"
        >
          Buscar en el mapa
        </Button>
      </div>
    </div>
  )
}
