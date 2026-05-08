import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import L from 'leaflet'
import { MapPin, Search, Star, DollarSign, X, Crosshair, Info } from 'lucide-react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import marker2x from 'leaflet/dist/images/marker-icon-2x.png'
import marker from 'leaflet/dist/images/marker-icon.png'
import shadow from 'leaflet/dist/images/marker-shadow.png'
import { Button, Input } from './UI'

L.Icon.Default.mergeOptions({
  iconRetinaUrl: marker2x,
  iconUrl: marker,
  shadowUrl: shadow,
})

interface Property {
  id: number
  title: string
  price: number
  location: string
  latitude?: number
  longitude?: number
  averageRating: number
  reviewsCount: number
  images: string[]
  isAvailable: boolean
}

interface InteractiveMapProps {
  properties: Property[]
  onPropertyClick: (property: Property) => void
  onLocationSelect: (lat: number, lng: number) => void
  center?: { lat: number; lng: number }
  zoom?: number
}

type ResolvedProperty = Property & { latitude: number; longitude: number }

const geocodeCache = new Map<string, { lat: number; lng: number }>()
const GEO_CACHE_KEY = 'rial_geocode_cache_v1'

function readGeocodeCache() {
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, { lat: number; lng: number }>
    Object.entries(parsed).forEach(([k, v]) => {
      if (typeof v?.lat === 'number' && typeof v?.lng === 'number') geocodeCache.set(k, v)
    })
  } catch {
    // Ignore cache parsing issues.
  }
}

function saveGeocodeCache() {
  try {
    const serializable: Record<string, { lat: number; lng: number }> = {}
    geocodeCache.forEach((v, k) => {
      serializable[k] = v
    })
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(serializable))
  } catch {
    // Ignore storage issues.
  }
}

function FitBounds({ points }: { points: Array<{ latitude: number; longitude: number }> }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    const bounds = L.latLngBounds(points.map((p) => [p.latitude, p.longitude] as [number, number]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
  }, [map, points])
  return null
}

function FlyToLocation({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    map.flyTo([target.lat, target.lng], 14, { duration: 0.8 })
  }, [map, target])
  return null
}

async function geocodeLocation(query: string): Promise<{ lat: number; lng: number } | null> {
  const key = query.trim().toLowerCase()
  if (!key) return null
  const cached = geocodeCache.get(key)
  if (cached) return cached
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
    const res = await fetch(url)
    if (!res.ok) return null
    const rows = await res.json()
    const first = Array.isArray(rows) ? rows[0] : null
    const lat = Number(first?.lat)
    const lng = Number(first?.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    const point = { lat, lng }
    geocodeCache.set(key, point)
    saveGeocodeCache()
    return point
  } catch {
    return null
  }
}

export function InteractiveMap({
  properties,
  onPropertyClick,
  onLocationSelect,
  center = { lat: 25.7617, lng: -80.1918 },
  zoom = 11,
}: InteractiveMapProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProperty, setSelectedProperty] = useState<ResolvedProperty | null>(null)
  const [resolvedProperties, setResolvedProperties] = useState<ResolvedProperty[]>([])
  const [isResolving, setIsResolving] = useState(false)
  const [searchTarget, setSearchTarget] = useState<{ lat: number; lng: number } | null>(null)
  const [userLocationTarget, setUserLocationTarget] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    readGeocodeCache()
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setIsResolving(true)
      const resolved: ResolvedProperty[] = []
      for (const property of properties) {
        if (typeof property.latitude === 'number' && typeof property.longitude === 'number') {
          resolved.push({ ...property, latitude: property.latitude, longitude: property.longitude })
          continue
        }
        const point = await geocodeLocation(property.location)
        if (point) resolved.push({ ...property, latitude: point.lat, longitude: point.lng })
      }
      if (!cancelled) {
        setResolvedProperties(resolved)
        setIsResolving(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [properties])

  const mapCenter = useMemo(() => {
    if (!resolvedProperties.length) return center
    const avgLat = resolvedProperties.reduce((sum, p) => sum + p.latitude, 0) / resolvedProperties.length
    const avgLng = resolvedProperties.reduce((sum, p) => sum + p.longitude, 0) / resolvedProperties.length
    return { lat: avgLat, lng: avgLng }
  }, [resolvedProperties, center])

  const searchLocation = async () => {
    const point = await geocodeLocation(searchQuery)
    if (!point) return
    setSearchTarget(point)
    onLocationSelect(point.lat, point.lng)
  }

  const getUserLocation = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((position) => {
      const target = { lat: position.coords.latitude, lng: position.coords.longitude }
      setUserLocationTarget(target)
      onLocationSelect(target.lat, target.lng)
    })
  }

  const handleMarkerClick = (property: ResolvedProperty) => {
    setSelectedProperty(property)
  }

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden">
      <div className="absolute top-4 left-4 right-4 z-[1000] flex items-center gap-2">
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
      </div>

      <MapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={zoom} className="w-full h-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={resolvedProperties} />
        <FlyToLocation target={searchTarget || userLocationTarget} />

        {resolvedProperties.map((property) => (
          <Marker
            key={property.id}
            position={[property.latitude, property.longitude]}
            eventHandlers={{ click: () => handleMarkerClick(property) }}
          >
            <Popup>
              <div className="min-w-[220px]">
                <div className="font-semibold mb-1">{property.title}</div>
                <div className="text-xs text-gray-600 mb-2">{property.location}</div>
                <div className="text-sm font-medium">${property.price}/mes</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {isResolving && (
        <div className="absolute bottom-4 left-4 z-[1000] rounded-lg bg-white/95 dark:bg-gray-800/95 px-3 py-2 text-xs shadow">
          Resolviendo ubicaciones reales...
        </div>
      )}

      <AnimatePresence>
        {selectedProperty && (
          <motion.div
            className="absolute bottom-4 left-4 right-4 z-[1000] bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-gray-200 dark:border-gray-700"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{selectedProperty.title}</h3>
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
                <Button size="sm" onClick={() => onPropertyClick(selectedProperty)} icon={<Info className="w-4 h-4" />}>
                  Ver detalles
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedProperty(null)} icon={<X className="w-4 h-4" />} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

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
        <Input placeholder="Ubicación o dirección..." value={query} onChange={setQuery} icon={<Search className="w-4 h-4" />} />
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
        <Button onClick={() => onSearch(query, filters)} icon={<Search className="w-4 h-4" />} className="w-full">
          Buscar en el mapa
        </Button>
      </div>
    </div>
  )
}
