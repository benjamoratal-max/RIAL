import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import L from 'leaflet'
import { MapPin, Search, Star, DollarSign, X, Crosshair, Info, Bed, Bath, Home } from 'lucide-react'
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { useTranslation } from 'react-i18next'
import 'leaflet/dist/leaflet.css'
import { Button, Input } from './UI'

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
  bedrooms?: number
  bathrooms?: number
  rooms?: number
  type?: string
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
const MAX_GEOCODE_CONCURRENCY = 8

/** Bounding box aproximado de Miami-Dade County */
const MIAMI_BOUNDS = { south: 25.12, north: 25.98, west: -80.88, east: -80.10 }

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

function isMiamiContext(address: string): boolean {
  const normalized = sanitizeAddress(address).toLowerCase()
  return (
    normalized.includes('miami') ||
    normalized.includes('miami-dade') ||
    /\bflorida\b/.test(normalized) ||
    /\bfl\b/.test(normalized) ||
    /\b\d{5}\b/.test(normalized)
  )
}

function isWithinMiamiBounds(lat: number, lng: number): boolean {
  return (
    lat >= MIAMI_BOUNDS.south &&
    lat <= MIAMI_BOUNDS.north &&
    lng >= MIAMI_BOUNDS.west &&
    lng <= MIAMI_BOUNDS.east
  )
}

function createMarkerIcon(hovered: boolean, selected: boolean): L.DivIcon {
  const active = hovered || selected
  const size = active ? 38 : 30
  const bg = selected ? '#b8860b' : hovered ? '#1e3a5f' : '#334155'
  const scale = active ? 'scale(1.15)' : 'scale(1)'
  const shadow = active
    ? '0 4px 14px rgba(0,0,0,0.35), 0 0 0 3px rgba(184,134,11,0.45)'
    : '0 2px 8px rgba(0,0,0,0.25)'

  return L.divIcon({
    className: 'rial-map-marker-icon',
    html: `
      <div style="
        width:${size}px;height:${size}px;
        background:${bg};
        border:2.5px solid #fff;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg) ${scale};
        box-shadow:${shadow};
        transition:transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        cursor:pointer;
      ">
        <div style="
          width:8px;height:8px;
          background:#fff;
          border-radius:50%;
          position:absolute;
          top:50%;left:50%;
          transform:translate(-50%,-50%) rotate(45deg);
        "></div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
    tooltipAnchor: [0, -size - 4],
  })
}

function PropertyMarker({
  property,
  isHovered,
  isSelected,
  onHover,
  onClick,
}: {
  property: ResolvedProperty
  isHovered: boolean
  isSelected: boolean
  onHover: (id: number | null) => void
  onClick: (property: ResolvedProperty) => void
}) {
  const { t } = useTranslation()
  const icon = useMemo(() => createMarkerIcon(isHovered, isSelected), [isHovered, isSelected])
  const image = property.images?.[0]

  return (
    <Marker
      position={[property.latitude, property.longitude]}
      icon={icon}
      zIndexOffset={isSelected ? 2000 : isHovered ? 1000 : 0}
      eventHandlers={{
        mouseover: () => onHover(property.id),
        mouseout: () => onHover(null),
        click: () => onClick(property),
      }}
    >
      <Tooltip
        direction="top"
        offset={[0, -36]}
        opacity={1}
        className="rial-map-tooltip"
      >
        <div className="min-w-[180px] max-w-[240px] p-0.5">
          {image && (
            <img
              src={image}
              alt=""
              className="w-full h-20 object-cover rounded-md mb-2"
            />
          )}
          <div className="font-semibold text-sm leading-tight mb-1">{property.title}</div>
          <div className="text-xs text-gray-600 dark:text-gray-300 mb-1.5 flex items-start gap-1">
            <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
            <span>{property.location}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              ${property.price.toLocaleString()}{t('propertyCard.perMonth')}
            </span>
            {property.averageRating > 0 && (
              <span className="flex items-center gap-0.5 text-amber-600">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {property.averageRating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </Tooltip>
    </Marker>
  )
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

function FlyToProperty({ property }: { property: ResolvedProperty | null }) {
  const map = useMap()
  useEffect(() => {
    if (!property) return
    map.flyTo([property.latitude, property.longitude], Math.max(map.getZoom(), 15), { duration: 0.5 })
  }, [map, property?.id, property?.latitude, property?.longitude])
  return null
}

async function geocodeLocation(query: string, miamiOnly = false): Promise<{ lat: number; lng: number } | null> {
  const key = `${miamiOnly ? 'mia:' : ''}${query.trim().toLowerCase()}`
  if (!key || key === 'mia:') return null
  const cached = geocodeCache.get(key)
  if (cached && (!miamiOnly || isWithinMiamiBounds(cached.lat, cached.lng))) return cached
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '1')
    url.searchParams.set('q', query)
    if (miamiOnly) {
      url.searchParams.set('countrycodes', 'us')
      url.searchParams.set('viewbox', `${MIAMI_BOUNDS.west},${MIAMI_BOUNDS.north},${MIAMI_BOUNDS.east},${MIAMI_BOUNDS.south}`)
      url.searchParams.set('bounded', '1')
    }
    const res = await fetch(url.toString())
    if (!res.ok) return null
    const rows = await res.json()
    const first = Array.isArray(rows) ? rows[0] : null
    const lat = Number(first?.lat)
    const lng = Number(first?.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    if (miamiOnly && !isWithinMiamiBounds(lat, lng)) return null
    const point = { lat, lng }
    geocodeCache.set(key, point)
    saveGeocodeCache()
    return point
  } catch {
    return null
  }
}

function parseUsAddress(address: string): { street: string; city: string; state: string; postalcode?: string } | null {
  const cleaned = sanitizeAddress(address)
  const m = cleaned.match(/^(.+?),\s*([^,]+),\s*([A-Z]{2})(?:\s+(\d{5}))?/i)
  if (!m) return null
  return {
    street: m[1].trim(),
    city: m[2].trim(),
    state: m[3].toUpperCase(),
    postalcode: m[4] ? m[4].trim() : undefined,
  }
}

async function geocodeUsStructured(address: string): Promise<{ lat: number; lng: number } | null> {
  const parsed = parseUsAddress(address)
  if (!parsed) return null
  const key = `us:${parsed.street}|${parsed.city}|${parsed.state}|${parsed.postalcode || ''}`.toLowerCase()
  const cached = geocodeCache.get(key)
  if (cached && isWithinMiamiBounds(cached.lat, cached.lng)) return cached

  try {
    const singleLine = [parsed.street, parsed.city, parsed.state, parsed.postalcode].filter(Boolean).join(', ')
    const censusUrl = new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress')
    censusUrl.searchParams.set('address', singleLine)
    censusUrl.searchParams.set('benchmark', 'Public_AR_Current')
    censusUrl.searchParams.set('format', 'json')

    const censusRes = await fetch(censusUrl.toString())
    if (censusRes.ok) {
      const data = await censusRes.json()
      const matches = data?.result?.addressMatches
      if (Array.isArray(matches) && matches.length > 0) {
        const first = matches[0]
        const lat = Number(first?.coordinates?.y)
        const lng = Number(first?.coordinates?.x)
        if (Number.isFinite(lat) && Number.isFinite(lng) && isWithinMiamiBounds(lat, lng)) {
          const point = { lat, lng }
          geocodeCache.set(key, point)
          saveGeocodeCache()
          return point
        }
      }
    }
  } catch {
    // Seguir con fallback si falla Census.
  }

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', '1')
    url.searchParams.set('street', parsed.street)
    url.searchParams.set('city', parsed.city)
    url.searchParams.set('state', parsed.state)
    if (parsed.postalcode) url.searchParams.set('postalcode', parsed.postalcode)
    url.searchParams.set('country', 'USA')

    const res = await fetch(url.toString())
    if (!res.ok) return null
    const rows = await res.json()
    const first = Array.isArray(rows) ? rows[0] : null
    const lat = Number(first?.lat)
    const lng = Number(first?.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isWithinMiamiBounds(lat, lng)) return null
    const point = { lat, lng }
    geocodeCache.set(key, point)
    saveGeocodeCache()
    return point
  } catch {
    return null
  }
}

function getStructuredCacheKey(address: string): string | null {
  const parsed = parseUsAddress(address)
  if (!parsed) return null
  return `us:${parsed.street}|${parsed.city}|${parsed.state}|${parsed.postalcode || ''}`.toLowerCase()
}

function getCachedPointForProperty(property: Property): { lat: number; lng: number } | null {
  const structuredKey = getStructuredCacheKey(property.location)
  if (structuredKey) {
    const structuredCached = geocodeCache.get(structuredKey)
    if (structuredCached && isWithinMiamiBounds(structuredCached.lat, structuredCached.lng)) {
      return structuredCached
    }
  }
  const cachedCandidates = buildGeocodeCandidates(property)
  for (const candidate of cachedCandidates) {
    const cached = geocodeCache.get(candidate.trim().toLowerCase())
    if (cached && isWithinMiamiBounds(cached.lat, cached.lng)) return cached
  }
  return null
}

function simpleHash(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function sanitizeAddress(raw: string): string {
  return String(raw || '')
    .replace(/\b(\d{5})-\d{4}\b/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/,\s*,/g, ',')
    .trim()
}

function buildGeocodeCandidates(property: Property): string[] {
  const location = sanitizeAddress(property.location)
  const title = sanitizeAddress(property.title)
  const miamiSuffix = ', Miami, FL, USA'
  const candidates = [
    location,
    location.includes('Miami') ? location : `${location}${miamiSuffix}`,
    `${title}, ${location}`,
    `${location}, Miami-Dade County, Florida, USA`,
    `${title}, Miami, FL, USA`,
  ]
  return Array.from(new Set(candidates.filter(Boolean)))
}

function acceptGeocodedPoint(point: { lat: number; lng: number }, address: string): { lat: number; lng: number } | null {
  if (isMiamiContext(address) && !isWithinMiamiBounds(point.lat, point.lng)) return null
  return normalizePointForAddress(point, address)
}

async function geocodeProperty(property: Property): Promise<{ lat: number; lng: number } | null> {
  const structured = await geocodeUsStructured(property.location)
  if (structured) {
    const accepted = acceptGeocodedPoint(structured, property.location)
    if (accepted) return accepted
  }
  const candidates = buildGeocodeCandidates(property)
  const miamiOnly = isMiamiContext(property.location)
  for (const candidate of candidates) {
    const point = await geocodeLocation(candidate, miamiOnly)
    if (!point) continue
    const accepted = acceptGeocodedPoint(point, property.location)
    if (accepted) return accepted
  }
  return null
}

function normalizePointForAddress(point: { lat: number; lng: number }, address: string): { lat: number; lng: number } {
  const normalizedAddress = sanitizeAddress(address).toLowerCase()
  const isMiamiAddress = isMiamiContext(normalizedAddress)
  if (!isMiamiAddress) return point

  const hasStreetHint = /\b(nw|sw|ne|se|ave|avenue|st|street|rd|road|blvd)\b/i.test(normalizedAddress)
  const looksOffshore = point.lng > -80.185

  if (!hasStreetHint || !looksOffshore) return point

  const correctedLng = Math.min(-80.205, point.lng - 0.045)
  return { lat: point.lat, lng: correctedLng }
}

function hasValidStoredCoords(property: Property): boolean {
  if (typeof property.latitude !== 'number' || typeof property.longitude !== 'number') return false
  if (!Number.isFinite(property.latitude) || !Number.isFinite(property.longitude)) return false
  if (isMiamiContext(property.location)) {
    return isWithinMiamiBounds(property.latitude, property.longitude)
  }
  return true
}

function fallbackByCity(address: string, seedText: string): { lat: number; lng: number } {
  const normalized = sanitizeAddress(address).toLowerCase()
  const hash = simpleHash(`${normalized}|${seedText}`)

  const lat = 25.70 + ((hash % 1000) / 1000) * 0.20
  const lng = -80.32 + (((hash / 1000) % 1000) / 1000) * 0.12
  return { lat, lng }
}

function MapPropertyPanel({
  property,
  onClose,
  onViewDetail,
}: {
  property: ResolvedProperty
  onClose: () => void
  onViewDetail: () => void
}) {
  const { t } = useTranslation()
  const image = property.images?.[0]

  return (
    <motion.aside
      className="w-[min(100%,340px)] shrink-0 flex flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 overflow-hidden"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.2 }}
    >
      {image ? (
        <div className="relative h-44 shrink-0">
          <img src={image} alt={property.title} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label={t('map.closePanel')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex justify-end p-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={t('map.closePanel')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white leading-snug">{property.title}</h3>
          {property.type && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{property.type}</p>
          )}
        </div>

        <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
          <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-rial-gold" />
          <span>{property.location}</span>
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 text-base">
            <DollarSign className="w-4 h-4" />
            ${property.price.toLocaleString()}{t('propertyCard.perMonth')}
          </span>
          {property.averageRating > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-600">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              {property.averageRating.toFixed(1)} ({property.reviewsCount})
            </span>
          )}
        </div>

        {(property.bedrooms != null || property.bathrooms != null || property.rooms != null) && (
          <div className="flex flex-wrap gap-3 text-sm text-gray-600 dark:text-gray-400">
            {property.bedrooms != null && property.bedrooms > 0 && (
              <span className="inline-flex items-center gap-1">
                <Bed className="w-4 h-4" />
                {property.bedrooms} {t('filtersAdvanced.bedrooms').toLowerCase()}
              </span>
            )}
            {property.bathrooms != null && property.bathrooms > 0 && (
              <span className="inline-flex items-center gap-1">
                <Bath className="w-4 h-4" />
                {property.bathrooms} {t('filtersAdvanced.bathrooms').toLowerCase()}
              </span>
            )}
            {property.rooms != null && property.rooms > 0 && (
              <span className="inline-flex items-center gap-1">
                <Home className="w-4 h-4" />
                {property.rooms} {t('filtersAdvanced.rooms').toLowerCase()}
              </span>
            )}
          </div>
        )}

        <span
          className={`inline-block text-xs font-medium px-2 py-1 rounded-full ${
            property.isAvailable
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          {property.isAvailable ? t('map.available') : t('map.unavailable')}
        </span>
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
        <Button onClick={onViewDetail} icon={<Info className="w-4 h-4" />} className="w-full">
          {t('propertyCard.viewDetail')}
        </Button>
      </div>
    </motion.aside>
  )
}

export function InteractiveMap({
  properties,
  onPropertyClick,
  onLocationSelect,
  center = { lat: 25.7617, lng: -80.1918 },
  zoom = 11,
}: InteractiveMapProps) {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProperty, setSelectedProperty] = useState<ResolvedProperty | null>(null)
  const [hoveredId, setHoveredId] = useState<number | null>(null)
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
      const immediate: ResolvedProperty[] = properties.map((property) => {
        if (hasValidStoredCoords(property)) {
          const normalized = normalizePointForAddress(
            { lat: property.latitude!, lng: property.longitude! },
            property.location
          )
          return { ...property, latitude: normalized.lat, longitude: normalized.lng }
        }
        const cachedPoint = getCachedPointForProperty(property)
        if (cachedPoint) {
          const normalized = normalizePointForAddress(cachedPoint, property.location)
          return { ...property, latitude: normalized.lat, longitude: normalized.lng }
        }
        const fallback = fallbackByCity(property.location, `${property.id}-${property.title}`)
        return { ...property, latitude: fallback.lat, longitude: fallback.lng }
      })

      if (!cancelled) setResolvedProperties(immediate)

      const pending = properties.filter((property) => {
        if (hasValidStoredCoords(property)) return false
        return !getCachedPointForProperty(property)
      })

      if (pending.length === 0) {
        if (!cancelled) setIsResolving(false)
        return
      }

      if (!cancelled) setIsResolving(true)
      const resolvedMap = new Map<number, ResolvedProperty>(immediate.map((p) => [p.id, p]))
      let cursor = 0

      const worker = async () => {
        while (!cancelled) {
          const idx = cursor++
          if (idx >= pending.length) return
          const property = pending[idx]
          const point = await geocodeProperty(property)
          if (!point) continue
          resolvedMap.set(property.id, { ...property, latitude: point.lat, longitude: point.lng })
          if (!cancelled) {
            setResolvedProperties(Array.from(resolvedMap.values()))
          }
        }
      }

      const workers = Array.from({ length: Math.min(MAX_GEOCODE_CONCURRENCY, pending.length) }, () => worker())
      await Promise.all(workers)
      if (!cancelled) setIsResolving(false)
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
    const point = await geocodeLocation(searchQuery, true)
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
    <div className="flex w-full h-full min-h-[480px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
      <div className="relative flex-1 min-w-0">
        <div className="absolute top-4 left-4 right-4 z-[1000] flex items-center gap-2">
          <div className="flex-1">
            <Input
              placeholder={t('map.searchPlaceholder')}
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

        <MapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={zoom} className="w-full h-full min-h-[480px]">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={resolvedProperties} />
          <FlyToLocation target={searchTarget || userLocationTarget} />
          <FlyToProperty property={selectedProperty} />

          {resolvedProperties.map((property) => (
            <PropertyMarker
              key={property.id}
              property={property}
              isHovered={hoveredId === property.id}
              isSelected={selectedProperty?.id === property.id}
              onHover={setHoveredId}
              onClick={handleMarkerClick}
            />
          ))}
        </MapContainer>

        {isResolving && (
          <div className="absolute bottom-4 left-4 z-[1000] rounded-lg bg-white/95 dark:bg-gray-800/95 px-3 py-2 text-xs shadow">
            {t('map.resolvingLocations')}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedProperty && (
          <MapPropertyPanel
            property={selectedProperty}
            onClose={() => setSelectedProperty(null)}
            onViewDetail={() => {
              const p = selectedProperty
              setSelectedProperty(null)
              onPropertyClick(p)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export function AdvancedMapSearch({ onSearch }: { onSearch: (query: string, filters: any) => void }) {
  const { t } = useTranslation()
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
      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{t('map.advancedSearchTitle')}</h3>
      <div className="space-y-3">
        <Input placeholder={t('map.addressPlaceholder')} value={query} onChange={setQuery} icon={<Search className="w-4 h-4" />} />
        <div>
          <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">{t('map.searchRadiusLabel')}</label>
          <select
            value={filters.radius}
            onChange={(e) => setFilters({ ...filters, radius: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          >
            <option value={1000}>{t('map.radius1km')}</option>
            <option value={5000}>{t('map.radius5km')}</option>
            <option value={10000}>{t('map.radius10km')}</option>
            <option value={25000}>{t('map.radius25km')}</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
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
        </div>
        <Button onClick={() => onSearch(query, filters)} icon={<Search className="w-4 h-4" />} className="w-full">
          {t('map.searchInMap')}
        </Button>
      </div>
    </div>
  )
}
